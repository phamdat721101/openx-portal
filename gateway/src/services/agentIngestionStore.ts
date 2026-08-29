/**
 * agentIngestionStore.ts — In-memory & reactive telemetry store for Gateway Sidecar.
 */

import {
  AgentTelemetryPayload,
  AgentTaskProjection,
  AgentMemoryEpisodePayload,
  AgentSkillCandidatePayload,
  SkillExecutionMetrics,
  SkillLifecycleStatus,
} from '../types/agentIngestion.js';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gatewayDatabase } from '../db/database.js';

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

interface PersistedIngestionState {
  telemetry: StoredTelemetry[];
  episodes: StoredEpisode[];
  skills: StoredSkill[];
  skillStatuses?: Record<string, SkillLifecycleStatus>;
}

class AgentIngestionStore {
  private telemetryByAgent: Map<string, StoredTelemetry[]> = new Map();
  private episodesByAgent: Map<string, StoredEpisode[]> = new Map();
  private skillsByAgent: Map<string, StoredSkill[]> = new Map();
  private skillStatuses: Record<string, SkillLifecycleStatus> = {};
  private readonly telemetryPath = process.env.OPENX_TELEMETRY_STORE_PATH;

  constructor() {
    this.loadTelemetry();
  }

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
    this.persist();

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
    this.persist();

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
    this.persist();

    return item;
  }

  public getTelemetry(agentId: string, limit = 20): StoredTelemetry[] {
    const list = this.telemetryByAgent.get(agentId) || [];
    return list.slice(0, limit);
  }

  public getCandidateSkills(agentId: string): StoredSkill[] {
    return [...(this.skillsByAgent.get(agentId) || [])];
  }

  public getSkillStatus(agentId: string, skillId: string): SkillLifecycleStatus | undefined {
    return this.skillStatuses[`${agentId}:${skillId}`];
  }

  public setSkillStatus(agentId: string, skillId: string, status: SkillLifecycleStatus): void {
    this.skillStatuses[`${agentId}:${skillId}`] = status;
    this.persist();
  }

  /** Metadata-only totals; telemetry summaries and tool identifiers are safe to expose. */
  public getExecutionMetrics(agentId: string, identifier: string): SkillExecutionMetrics {
    const events = (this.telemetryByAgent.get(agentId) || []).filter((event) => (event.tools_used || []).includes(identifier));
    const successful = events.filter((event) => event.status === 'success');
    const latencyEvents = events.filter((event) => (event.latency_ms || 0) > 0);
    return {
      total_calls: events.length,
      successful_calls: successful.length,
      failed_calls: events.length - successful.length,
      avg_latency_ms: latencyEvents.length ? Math.round(latencyEvents.reduce((total, event) => total + (event.latency_ms || 0), 0) / latencyEvents.length) : null,
      last_called_at: events[0]?.received_at || null,
    };
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

  public getTaskActivity(agentId: string, staleAfterSeconds = 90): { current_task: AgentTaskProjection | null; latest_task: AgentTaskProjection | null } {
    const telemetry = this.telemetryByAgent.get(agentId) || [];
    const latestByTask = new Map<string, StoredTelemetry>();
    for (const event of telemetry) {
      if (!latestByTask.has(event.task_id)) latestByTask.set(event.task_id, event);
    }
    const tasks = Array.from(latestByTask.values()).map((event) => this.projectTask(event, telemetry, staleAfterSeconds));
    const current_task = tasks.find((task) => task.state === 'running') || null;
    const latest_task = tasks.find((task) => task.state !== 'running') || null;
    return { current_task, latest_task };
  }

  public getTaskHistory(agentId: string, limit = 20, staleAfterSeconds = 90): AgentTaskProjection[] {
    const telemetry = this.telemetryByAgent.get(agentId) || [];
    const latestByTask = new Map<string, StoredTelemetry>();
    for (const event of telemetry) if (!latestByTask.has(event.task_id)) latestByTask.set(event.task_id, event);
    return Array.from(latestByTask.values()).map((event) => this.projectTask(event, telemetry, staleAfterSeconds)).slice(0, Math.max(1, Math.min(limit, 50)));
  }

  public clear() {
    this.telemetryByAgent.clear();
    this.episodesByAgent.clear();
    this.skillsByAgent.clear();
    this.skillStatuses = {};
    this.persist();
  }

  private projectTask(event: StoredTelemetry, allEvents: StoredTelemetry[], staleAfterSeconds: number): AgentTaskProjection {
    const taskEvents = allEvents.filter((item) => item.task_id === event.task_id);
    const first = taskEvents.at(-1);
    const state = event.task_state || (event.status === 'failed' ? 'failed' : 'completed');
    const isFresh = Date.now() - new Date(event.received_at).getTime() <= staleAfterSeconds * 1000;
    const running = (state === 'started' || state === 'heartbeat') && isFresh;
    const startedAt = first?.received_at || null;
    const ended = running ? null : event.received_at;
    return {
      task_id: event.task_id,
      state: running ? 'running' : state === 'failed' ? 'failed' : 'completed',
      title: event.task_title || null,
      category: event.task_category || null,
      phase: event.current_phase || null,
      progress_pct: event.progress_pct ?? null,
      model: event.model,
      tools_used: event.tools_used || [],
      started_at: startedAt,
      last_heartbeat_at: event.received_at,
      completed_at: ended,
      elapsed_ms: Math.max(0, new Date(ended || event.received_at).getTime() - new Date(startedAt || event.received_at).getTime()),
    };
  }

  private loadTelemetry(): void {
    if (!this.telemetryPath) {
      const state = gatewayDatabase.read<PersistedIngestionState>('agent_ingestion', { telemetry: [], episodes: [], skills: [] });
      this.hydrate(state.telemetry, this.telemetryByAgent);
      this.hydrate(state.episodes, this.episodesByAgent);
      this.hydrate(state.skills, this.skillsByAgent);
      this.skillStatuses = state.skillStatuses || {};
      return;
    }
    if (!existsSync(this.telemetryPath)) return;
    try {
      const events = JSON.parse(readFileSync(this.telemetryPath, 'utf8')) as StoredTelemetry[];
      this.hydrate(events, this.telemetryByAgent);
    } catch {
      // Telemetry persistence is advisory in development; the gateway remains available.
    }
  }

  private hydrate<T extends { agent_id: string; received_at: string }>(events: T[], target: Map<string, T[]>): void {
    for (const event of events) { const list = target.get(event.agent_id) || []; list.push(event); target.set(event.agent_id, list); }
    for (const list of target.values()) list.sort((a, b) => b.received_at.localeCompare(a.received_at));
  }

  private persist(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = Array.from(this.telemetryByAgent.values()).flat().filter((event) => new Date(event.received_at).getTime() >= cutoff);
    if (!this.telemetryPath) {
      gatewayDatabase.write('agent_ingestion', { telemetry: events, episodes: Array.from(this.episodesByAgent.values()).flat(), skills: Array.from(this.skillsByAgent.values()).flat(), skillStatuses: this.skillStatuses });
      return;
    }
    try {
      mkdirSync(dirname(this.telemetryPath), { recursive: true, mode: 0o700 });
      const temporary = `${this.telemetryPath}.tmp`;
      writeFileSync(temporary, JSON.stringify(events), { encoding: 'utf8', mode: 0o600 });
      renameSync(temporary, this.telemetryPath);
    } catch {
      // In-memory ingestion remains available; deployment health exposes durable registry state separately.
    }
  }
}

export const agentIngestionStore = new AgentIngestionStore();
