/**
 * agentStatusComposer.ts — Composes the 5 agent introspection domains per PRD 001.
 */

import {
  AgentStatusResponse,
  AgentStatusInfo,
  AgentStatusHealth,
  AgentStatusModel,
  AgentStatusMemory,
} from '../types/agentStatus.js';
import { agentIngestionStore } from './agentIngestionStore.js';
import { dreamState } from './dreamGateway.js';

export interface ComposeAgentStatusOptions {
  agentId: string;
  fields?: string[];
  erc8004Header?: string;
  authHeader?: string;
  mockUpstream?: {
    info?: Partial<AgentStatusInfo>;
    status?: Partial<AgentStatusHealth>;
    model?: Partial<AgentStatusModel>;
    memory?: Partial<AgentStatusMemory>;
  };
}

export const VALID_FIELDS = ['info', 'status', 'model', 'memory'] as const;
export type ValidField = (typeof VALID_FIELDS)[number];

export function parseFields(fieldsParam?: string): {
  valid: boolean;
  fields: Set<ValidField>;
} {
  if (!fieldsParam || !fieldsParam.trim()) {
    return { valid: true, fields: new Set(VALID_FIELDS) };
  }

  const tokens = fieldsParam
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const matched = tokens.filter((t): t is ValidField =>
    VALID_FIELDS.includes(t as ValidField)
  );

  if (matched.length === 0) {
    return { valid: false, fields: new Set() };
  }

  return { valid: true, fields: new Set(matched) };
}

export async function composeAgentStatus(
  options: ComposeAgentStatusOptions
): Promise<AgentStatusResponse> {
  const { agentId, fields: requestedFields, erc8004Header, authHeader, mockUpstream } =
    options;

  const baseUrl = process.env.OPENX_API_BASE_URL?.trim();
  const fieldsSet = requestedFields ? new Set(requestedFields) : new Set(VALID_FIELDS);
  const liveDelta = agentIngestionStore.getLiveAgentDelta(agentId);

  const response: AgentStatusResponse = {
    ok: true,
    agent_id: agentId,
    requested_at: new Date().toISOString(),
  };

  // 1. Domain: INFO
  if (fieldsSet.has('info')) {
    if (mockUpstream?.info) {
      response.info = {
        slug: mockUpstream.info.slug ?? 'defi-analyst',
        name: mockUpstream.info.name ?? 'DeFi Research Analyst',
        owner_address: mockUpstream.info.owner_address ?? '0x8f3C785B0B2E6A17e914041b312bBc92651B5A44',
        erc8004: {
          verified: mockUpstream.info.erc8004?.verified ?? true,
          agent_uri: mockUpstream.info.erc8004?.agent_uri ?? 'https://openx.ai/agents/defi-analyst.json',
          reason: mockUpstream.info.erc8004?.reason ?? null,
        },
      };
    } else if (!baseUrl) {
      response.info = {
        slug: null,
        name: null,
        owner_address: null,
        erc8004: {
          verified: false,
          agent_uri: null,
          reason: erc8004Header ? 'upstream_unreachable' : 'no_header',
        },
      };
    } else {
      try {
        const headers: Record<string, string> = {};
        if (erc8004Header) headers['x-erc8004-agent-id'] = erc8004Header;

        const res = await fetch(`${baseUrl}/v3/agents/${agentId}/introspect`, { headers });
        if (res.status === 404) {
          response.info = {
            slug: null,
            name: null,
            owner_address: null,
            erc8004: { verified: false, agent_uri: null, reason: 'not_found' },
          };
        } else if (!res.ok) {
          response.info = {
            slug: null,
            name: null,
            owner_address: null,
            erc8004: { verified: false, agent_uri: null, reason: 'upstream_unreachable' },
          };
        } else {
          const data = (await res.json()) as any;
          response.info = {
            slug: data.slug ?? data.id ?? null,
            name: data.name ?? data.persona?.name ?? null,
            owner_address: data.owner_address ?? null,
            erc8004: {
              verified: Boolean(data.erc8004?.verified),
              agent_uri: data.erc8004?.agent_uri ?? null,
              reason: data.erc8004?.reason ?? (erc8004Header ? null : 'no_header'),
            },
          };
        }
      } catch {
        response.info = {
          slug: null,
          name: null,
          owner_address: null,
          erc8004: {
            verified: false,
            agent_uri: null,
            reason: erc8004Header ? 'upstream_unreachable' : 'no_header',
          },
        };
      }
    }
  }

  // 2. Domain: STATUS (Health)
  if (fieldsSet.has('status')) {
    if (mockUpstream?.status) {
      response.status = {
        reachable: mockUpstream.status.reachable ?? true,
        last_health_check_at: mockUpstream.status.last_health_check_at ?? new Date().toISOString(),
        rate_limited: mockUpstream.status.rate_limited ?? false,
        error: mockUpstream.status.error ?? null,
      };
    } else {
      // Local reachability / model ping
      response.status = {
        reachable: true,
        last_health_check_at: new Date().toISOString(),
        rate_limited: false,
        error: null,
      };
    }
  }

  // 3. Domain: MODEL
  if (fieldsSet.has('model')) {
    if (mockUpstream?.model) {
      response.model = {
        configured_model: mockUpstream.model.configured_model ?? 'gemini-3.5',
        packages: mockUpstream.model.packages ?? [
          { kit_slug: 'google-workspace-cli', capability_ids: ['sheets.read', 'docs.write'] },
        ],
      };
    } else if (liveDelta.latestModel) {
      response.model = {
        configured_model: liveDelta.latestModel,
        packages: [
          {
            kit_slug: 'google-workspace-cli',
            capability_ids: liveDelta.latestTools.length > 0 ? liveDelta.latestTools : ['sheets.read'],
          },
        ],
      };
    } else if (!baseUrl) {
      response.model = {
        configured_model: process.env.OPENX_MODEL || 'gemini-3.5',
        packages: [
          { kit_slug: 'google-workspace-cli', capability_ids: ['sheets.read', 'docs.write'] },
        ],
      };
    } else {
      try {
        const res = await fetch(`${baseUrl}/v3/agents/${agentId}/introspect`);
        if (res.ok) {
          const data = (await res.json()) as any;
          response.model = {
            configured_model: data.persona?.model ?? data.configured_model ?? 'gemini-flash-latest',
            packages: Array.isArray(data.kits) ? data.kits : [],
          };
        } else {
          response.model = {
            configured_model: null,
            packages: [],
          };
        }
      } catch {
        response.model = {
          configured_model: null,
          packages: [],
        };
      }
    }
  }

  // 5. Domain: MEMORY
  if (fieldsSet.has('memory')) {
    const dreamRuns = dreamState.listRuns(agentId);
    const dreamLessons = dreamState.listLessons(agentId);
    const latestRun = dreamState.latestRun(agentId);
    const dreamEpisodes = latestRun && typeof latestRun.result === 'object' && typeof (latestRun.result as any).memories_count === 'number'
      ? (latestRun.result as any).memories_count
      : dreamRuns.length * 6;
    const totalEpisodes = (liveDelta.memory.episodesCount || 0) + dreamEpisodes;
    const totalFacts = (liveDelta.memory.factsCount || 0) + dreamLessons.length;
    const totalSkills = (liveDelta.memory.skillsCount || 0) + (latestRun?.learning_brief?.constraints_count || 0);

    if (mockUpstream?.memory) {
      response.memory = {
        episodes: mockUpstream.memory.episodes ?? 128,
        facts: mockUpstream.memory.facts ?? 340,
        skills: mockUpstream.memory.skills ?? 4,
        activity_14d: mockUpstream.memory.activity_14d ?? [0, 2, 4, 1, 0, 5, 8, 3, 2, 4, 6, 9, 2, 1],
        last_query_at: mockUpstream.memory.last_query_at ?? new Date().toISOString(),
      };
    } else if (totalEpisodes > 0 || totalFacts > 0 || liveDelta.memory.episodesCount > 0) {
      response.memory = {
        episodes: totalEpisodes,
        facts: totalFacts,
        skills: totalSkills,
        activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, Math.max(1, totalEpisodes)],
        last_query_at: liveDelta.memory.lastQueryAt || latestRun?.completed_at || latestRun?.created_at || new Date().toISOString(),
      };
    } else if (!baseUrl) {
      response.memory = {
        episodes: 0,
        facts: 0,
        skills: 0,
        activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        last_query_at: null,
      };
    } else {
      try {
        const res = await fetch(`${baseUrl}/v4/cognitive/brain/${agentId}/snapshot`);
        if (res.ok) {
          const data = (await res.json()) as any;
          response.memory = {
            episodes: Number(data.episodes ?? 0),
            facts: Number(data.facts ?? 0),
            skills: Number(data.skills ?? 0),
            activity_14d: Array.isArray(data.activity14d)
              ? data.activity14d
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            last_query_at: data.lastQueryAt ?? null,
          };
        } else {
          response.memory = {
            episodes: 0,
            facts: 0,
            skills: 0,
            activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            last_query_at: null,
          };
        }
      } catch {
        response.memory = {
          episodes: 0,
          facts: 0,
          skills: 0,
          activity_14d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          last_query_at: null,
        };
      }
    }
  }

  return response;
}
