/**
 * agentIngestion.ts — Types and Schemas for Agent Submission APIs.
 */

export interface AgentTelemetryPayload {
  agent_id: string;
  task_id: string;
  model: string;
  tokens_consumed: number;
  tools_used?: string[];
  latency_ms?: number;
  status: 'success' | 'failed';
  cost_usdc?: string;
  summary?: string;
  timestamp?: string;
}

export interface AgentMemoryEpisodePayload {
  agent_id: string;
  episode_type: 'protocol_research' | 'market_scan' | 'execution_trace';
  summary: string;
  facts_count: number;
  confidence: number;
  entities?: string[];
  timestamp?: string;
}

export interface AgentSkillCandidatePayload {
  agent_id: string;
  skill_slug: string;
  display_name: string;
  capability_ids: string[];
  code_template?: string;
  timestamp?: string;
}

export interface IngestionSuccessResponse {
  ok: true;
  ingested_at: string;
  event_type: 'telemetry' | 'memory_episode' | 'skill_candidate';
  agent_id: string;
  id: string;
}

export interface IngestionErrorResponse {
  ok: false;
  error: 'invalid_payload' | 'missing_agent_id' | 'internal_error';
  message: string;
}

export interface AgentRegistrationResponse {
  ok: true;
  status: 'registered';
  agent: {
    agent_id: string;
    slug: string;
    display_name: string;
    state: string;
    owner_verified: boolean;
  };
  credential?: { agent_key: string; shown_once: true };
  telemetry_endpoint: string;
}
