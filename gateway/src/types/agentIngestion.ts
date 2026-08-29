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
  task_state?: 'started' | 'heartbeat' | 'completed' | 'failed';
  task_title?: string;
  task_category?: string;
  current_phase?: string;
  progress_pct?: number;
  summary?: string;
  timestamp?: string;
}

export interface AgentTaskProjection {
  task_id: string;
  state: 'running' | 'completed' | 'failed';
  title: string | null;
  category: string | null;
  phase: string | null;
  progress_pct: number | null;
  model: string;
  tools_used: string[];
  started_at: string | null;
  last_heartbeat_at: string;
  completed_at: string | null;
  elapsed_ms: number;
}

export type UsageTokenKind = 'input' | 'output' | 'cached_input' | 'reasoning';

export interface AgentUsageEventPayload {
  event_id: string;
  agent_id: string;
  occurred_at: string;
  plan_id?: string;
  model_usage?: Array<{
    provider: string;
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    cached_input_tokens?: number;
    reasoning_tokens?: number;
  }>;
  tool_calls?: Array<{
    tool_id: string;
    calls: number;
    billable_units?: number;
    outcome: 'success' | 'failed';
    latency_ms?: number;
  }>;
  skill_invocations?: Array<{
    skill_id: string;
    calls: number;
    outcome: 'success' | 'failed';
  }>;
  nim_savings?: Array<{
    primitive: string;
    model: string;
    token_kind: UsageTokenKind;
    baseline_tokens: number;
    actual_tokens: number;
  }>;
}

export interface AgentUsageSummary {
  agent_id: string;
  billing_month: string;
  plan_id: string;
  catalog_version: string;
  usage_events: number;
  input_tokens: number;
  output_tokens: number;
  tool_calls: number;
  skill_calls: number;
  included_allowance_micro_usdc: number;
  included_consumed_micro_usdc: number;
  nim_tokens_saved: number;
  unpriced_items: number;
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

export type SkillLifecycleStatus = 'active' | 'in_audit' | 'deprecated';

export interface SkillExecutionMetrics {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  avg_latency_ms: number | null;
  last_called_at: string | null;
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
