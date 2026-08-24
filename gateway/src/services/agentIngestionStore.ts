/**
 * agentIngestionStore.ts — In-memory & reactive telemetry store for Gateway Sidecar.
 */

import {
  AgentTelemetryPayload,
  AgentMemoryEpisodePayload,
  AgentSkillCandidatePayload,
} from '../types/agentIngestion.js';

interface StoredTelemetry extends AgentTelemetryPayload {
  id: string;
  received_at: string;
}

interface StoredEpisode extends AgentMemoryEpisodePayload {
  id: string;
  received_at: string;
}

interface StoredSkill extends AgentSkillCandidatePayload {
  id: string;
  received_at: string;
}

class AgentIngestionStore {
  private telemetryByAgent: Map<string, StoredTelemetry[]> = new Map();
  private episodesByAgent: Map<string, StoredEpisode[]> = new Map();
  private skillsByAgent: Map<string, StoredSkill[]> = new Map();

  public recordTelemetry(payload: AgentTelemetryPayload): StoredTelemetry {
    const agentId = payload.agent_id;
    const item: StoredTelemetry = {
      ...payload,
      id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      received_at: new Date().toISOString(),
      tools_used: payload.tools_used || [],
      latency_ms: payload.latency_ms || 0,
    };

    const list = this.telemetryByAgent.get(agentId) || [];
    list.unshift(item); // prepend newest
    // Cap at 100 recent entries per agent
    if (list.length > 100) list.pop();
    this.telemetryByAgent.set(agentId, list);

    return item;
  }

  public recordMemoryEpisode(payload: AgentMemoryEpisodePayload): StoredEpisode {
    const agentId = payload.agent_id;
    const item: StoredEpisode = {
      ...payload,
      id: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      received_at: new Date().toISOString(),
      entities: payload.entities || [],
    };

    const list = this.episodesByAgent.get(agentId) || [];
    list.unshift(item);
    if (list.length > 100) list.pop();
    this.episodesByAgent.set(agentId, list);

    return item;
  }

  public recordCandidateSkill(payload: AgentSkillCandidatePayload): StoredSkill {
    const agentId = payload.agent_id;
    const item: StoredSkill = {
      ...payload,
      id: `sk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      received_at: new Date().toISOString(),
    };

    const list = this.skillsByAgent.get(agentId) || [];
    list.unshift(item);
    if (list.length > 50) list.pop();
    this.skillsByAgent.set(agentId, list);

    return item;
  }

  public getTelemetry(agentId: string, limit = 20): StoredTelemetry[] {
    const list = this.telemetryByAgent.get(agentId) || [];
    return list.slice(0, limit);
  }

  public getAllRecentTelemetry(limit = 30): StoredTelemetry[] {
    const all: StoredTelemetry[] = [];
    for (const list of this.telemetryByAgent.values()) {
      all.push(...list);
    }
    all.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    return all.slice(0, limit);
  }

  public getMemorySummary(agentId: string) {
    const episodes = this.episodesByAgent.get(agentId) || [];
    const factsCount = episodes.reduce((acc, ep) => acc + (ep.facts_count || 0), 0);
    const skillsCount = (this.skillsByAgent.get(agentId) || []).length;
    const lastQueryAt = episodes.length > 0 ? episodes[0].received_at : null;

    return {
      episodesCount: episodes.length,
      factsCount,
      skillsCount,
      lastQueryAt,
    };
  }

  public getLiveAgentDelta(agentId: string) {
    const telemetry = this.telemetryByAgent.get(agentId) || [];
    const memory = this.getMemorySummary(agentId);

    const totalTokens = telemetry.reduce((acc, t) => acc + (t.tokens_consumed || 0), 0);
    const latestModel = telemetry.length > 0 ? telemetry[0].model : null;
    const latestTools = telemetry.length > 0 ? telemetry[0].tools_used || [] : [];

    return {
      hasLiveData: telemetry.length > 0 || memory.episodesCount > 0,
      totalTokens,
      latestModel,
      latestTools,
      memory,
    };
  }

  public clear() {
    this.telemetryByAgent.clear();
    this.episodesByAgent.clear();
    this.skillsByAgent.clear();
  }
}

export const agentIngestionStore = new AgentIngestionStore();
