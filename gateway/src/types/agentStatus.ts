/**
 * agentStatus.ts — Type definitions for PRD 001 (Agent Connection Feature)
 */

export type AgentStatusReason =
  | 'no_header'
  | 'upstream_unreachable'
  | 'feature_disabled'
  | 'not_found'
  | 'auth_required'
  | null;

export interface AgentStatusInfo {
  slug: string | null;
  name: string | null;
  owner_address: string | null;
  erc8004: {
    verified: boolean;
    agent_uri: string | null;
    reason: AgentStatusReason;
  };
}

export interface AgentStatusHealth {
  reachable: boolean;
  last_health_check_at: string;
  rate_limited: boolean;
  error: string | null;
}

export interface AgentStatusModel {
  configured_model: string | null;
  packages: Array<{
    kit_slug: string;
    capability_ids: string[];
  }>;
}

export interface AgentStatusMemory {
  episodes: number;
  facts: number;
  skills: number;
  activity_14d: number[];
  last_query_at: string | null;
}

export interface AgentStatusResponse {
  ok: true;
  agent_id: string;
  requested_at: string;
  info?: AgentStatusInfo | null;
  status?: AgentStatusHealth | null;
  model?: AgentStatusModel | null;
  memory?: AgentStatusMemory | null;
}

export interface AgentStatusErrorResponse {
  ok: false;
  error: 'missing_agent_id' | 'invalid_fields' | 'internal_error';
  message: string;
}
