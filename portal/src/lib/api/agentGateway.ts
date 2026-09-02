/**
 * agentGateway.ts — Portal API client for OpenX Gateway Sidecar (PRD 001).
 *
 * Connects to the standalone backend service on :7411.
 */

export interface GatewayAgentStatusResponse {
  ok: boolean;
  agent_id?: string;
  requested_at?: string;
  info?: {
    slug: string | null;
    name: string | null;
    owner_address: string | null;
    erc8004: {
      verified: boolean;
      agent_uri: string | null;
      reason: string | null;
    };
  } | null;
  status?: {
    reachable: boolean;
    last_health_check_at: string;
    rate_limited: boolean;
    error: string | null;
  } | null;
  model?: {
    configured_model: string | null;
    packages: Array<{
      kit_slug: string;
      capability_ids: string[];
    }>;
  } | null;
  memory?: {
    episodes: number;
    facts: number;
    skills: number;
    activity_14d: number[];
    last_query_at: string | null;
  } | null;
  error?: string;
  message?: string;
}

export interface IngestedTraceEvent {
  id: string;
  agent_id: string;
  task_id: string;
  model: string;
  tokens_consumed: number;
  tools_used: string[];
  latency_ms: number;
  status: 'success' | 'failed';
  summary?: string;
  received_at: string;
}

export interface AgentTaskActivity {
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

export interface AgentActivityProjection {
  agent_id: string;
  state: RegisteredAgentProjection['state'];
  last_seen_at: string | null;
  activity: { current_task: AgentTaskActivity | null; latest_task: AgentTaskActivity | null };
}
export interface FleetOverviewAgent {
  agent: RegisteredAgentProjection;
  connection: { state: RegisteredAgentProjection['state']; last_seen_at: string | null };
  dream: { linked: boolean; hypermove_agent_id: string | null; latest_run?: { id: string; status: string; completed_at: string | null; source: 'gateway' | 'hypermove_sync'; learning_brief?: DreamTriggerResponse['run'] extends infer Run ? Run extends { learning_brief?: infer Brief } ? Brief : never : never } };
  activity: AgentActivityProjection['activity'];
  audit: { ready: boolean; job_count: number };
  knowledge_sync?: KnowledgeSync;
}
export interface FleetOverview { agents: FleetOverviewAgent[]; summary: { registered: number; online: number; linked: number; auditor_ready: number }; }
export interface KnowledgeSync { agent_id: string; state: 'queued' | 'collecting' | 'uploading' | 'complete' | 'degraded'; total_records: number; uploaded_records: number; pending_records: number; failed_records: number; source_counts: Record<string, number>; updated_at: string; safe_error?: string; }

export interface UsageSummary {
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

export interface UsageDetail extends UsageSummary {
  tokens: { input_raw: number; output_generated: number; cached_prompt: number; reasoning_internal: number; total_effective: number; cache_hit_rate_pct: number };
  economics: { gross_model_cost_micro_usdc: number; actual_provider_cost_micro_usdc: number; revenue_micro_usdc: number; net_earnings_micro_usdc: number; gross_margin_pct: number | null };
  nim_savings: { total_tokens_saved: number; total_avoided_cost_micro_usdc: number; primitives: Array<{ name: string; tokens_saved: number; avoided_cost_micro_usdc: number; percentage_reduction: number }> };
}

export interface RegisteredAgentProjection {
  agent_id: string;
  slug: string;
  display_name: string;
  description: string | null;
  model: string | null;
  capabilities: string[];
  host_type: 'kiro-cli' | 'claude-code' | 'adk-python' | 'custom';
  owner_address: string | null;
  wallet_address: string | null;
  owner_verified: boolean;
  registration_source: 'explicit' | 'auto_discovered';
  state: 'registered' | 'online' | 'offline' | 'auto_discovered' | 'revoked';
  registered_at: string;
  last_seen_at: string | null;
}

export interface RegisterAgentInput {
  display_name: string;
  host_type: RegisteredAgentProjection['host_type'];
  slug?: string;
  description?: string;
  model?: string;
  capabilities?: string[];
  owner_address?: string;
  wallet_address?: string;
}
export interface ClaimAgentInput { agent_id: string; agent_key: string; }

export interface WalletSnapshot { address: string | null; chain_id: number; network: string; native_balance_wei: string | null; tokens: Array<{ address: string; symbol: string; decimals: number; balance: string }>; activity: Array<{ hash: string; timestamp: string | null; from: string; to: string | null; value: string }>; fetched_at: string; source_errors: string[]; }
export interface AuditRun { id: string; created_at: string; trigger: string; findings: Array<{ id: string; dimension: string; verdict: string; title: string; evidence: string[] }> }
export interface DreamAuditJob { id: string; dream_run_id: string; status: 'queued' | 'reviewing' | 'completed' | 'retrying' | 'not_configured'; attempts: number; next_attempt_at: string | null; error?: string; review?: { model: string; lesson_reviews: Array<{ lesson_id: string; verdict: 'keep' | 'revise' | 'reject'; rationale: string; evidence: string[] }>; skill_candidate?: { skill_slug: string; display_name: string; capability_ids: string[]; rationale: string } }; }
export interface AuditEvent { id: string; audit_job_id: string; agent_id: string; phase: 'queued' | 'gathering_evidence' | 'requesting_review' | 'validating' | 'persisting' | 'completed' | 'retrying' | 'failed' | 'not_configured'; message: string; created_at: string; }
export interface AuditChatTurn { id: string; audit_job_id: string; agent_id: string; role: 'user' | 'auditor'; content: string; confidence?: 'high' | 'medium' | 'low'; citations?: Array<{ kind: 'lesson' | 'review' | 'context' | 'agent' | 'dream' | 'task' | 'archive'; id: string; label: string; excerpt: string }>; created_at: string; }
export interface AuditorWorkspace { job: DreamAuditJob; events: AuditEvent[]; lessons: Array<{ id: string; content: string; state: string; source: string; created_at: string }>; lesson_scope: 'dream_run' | 'agent'; context: { generated_at?: string; morning_brief?: string; constraints_count?: number } | null; evidence: { agent: { id: string; display_name: string; state: string; last_seen_at: string | null; model: string | null; capabilities: string[] } | null; tasks: { total: number; completed: number; failed: number; current_task: unknown; recent: Array<{ task_id: string; state: string }> }; telemetry: { event_count: number; models: string[]; tools: string[] }; dream: { id: string; status: string; source: string; completed_at: string | null; has_stage_summaries: boolean } | null; usage: { tool_calls: number; skill_calls: number; input_tokens: number; output_tokens: number } }; chat: AuditChatTurn[]; }

export interface DreamLinkResponse { ok: boolean; link?: { hypermove_agent_id: string }; error?: string; message?: string; }
export interface DreamTriggerResponse {
  ok: boolean;
  imported?: boolean;
  run?: {
    id: string;
    status: string;
    settlement?: { status: 'settled' | 'failed'; quote_id: string; transaction_hash?: string; amount: string; currency: 'RLUSD'; destination: string; reason?: string };
    learning_brief?: { generated_at: string; morning_brief?: string; constraints_count: number; stage_summaries?: Record<string, unknown> };
    result?: { stage_summaries?: Record<string, unknown>; status?: string };
    reconciliation?: { last_checked_at: string; upstream_status?: string; last_error?: string };
    source?: 'gateway' | 'hypermove_sync';
  };
  quote?: unknown;
  error?: string;
  message?: string;
}
export interface DreamStateResponse { ok: boolean; link?: { hypermove_agent_id: string } | null; latest_run?: NonNullable<DreamTriggerResponse['run']> | null; error?: string; }
export interface GatewaySkillItem {
  id: string; name: string; slug: string; description: string; status: 'active' | 'in_audit' | 'deprecated'; version: string;
  trigger_patterns: string[]; audit_last_run: string | null; audit_score: number | null; created_at: string; author: string;
  source: 'local' | 'hypermove_promoted' | 'marketplace_fork';
  telemetry: { total_calls: number; successful_calls: number; failed_calls: number; avg_latency_ms: number | null; last_called_at: string | null };
}
export interface DreamReadinessResponse { ok: boolean; ready?: boolean; has_token?: boolean; token_vault_configured?: boolean; using_service_credential?: boolean; self_service_enabled?: boolean; hypermove_mcp_configured?: boolean; is_linked?: boolean; link?: { hypermove_agent_id: string } | null; readiness?: unknown; error?: string; message?: string; }
export interface ZeroGProvenance { status: 'pending' | 'uploading' | 'uploaded' | 'retrying' | 'failed' | 'disabled'; root_hash?: string; tx_hash?: string; explorer_url?: string; uploaded_at?: string; proof_available: boolean; message?: string; }
export interface DreamLesson { id: string; openx_agent_id: string; state: 'UNREVIEWED' | 'IN_REVIEW' | 'PROMOTED_CONSTRAINT' | 'QUARANTINED' | 'REJECTED'; content: string; source: 'manual' | 'dream_cycle'; created_at: string; resolved_at?: string; zerog_provenance?: ZeroGProvenance; }
export interface DreamLessonProof { verified: boolean; provenance: ZeroGProvenance; canonical_payload: unknown; }

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_OPENX_GATEWAY_URL || 'http://localhost:7411';

/** Browser-local WebMCP tools use this deliberately public, slim Gateway API. */
export type WebMcpSection = 'studio' | 'skills' | 'credit-model' | 'dream-cycle' | 'auditor';
async function webMcpRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}/v1/webmcp${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({ ok: false, error: 'invalid_gateway_response' }));
  return (!response.ok ? { ...body, ok: false } : body) as T;
}
export const webMcpFleet = () => webMcpRequest<{ ok: boolean; agents?: unknown[]; error?: string }>('/agents');
export const webMcpAgentOverview = (agentId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}`);
export const webMcpSkills = (agentId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/skills`);
export const webMcpWallet = (agentId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/wallet`);
export const webMcpDream = (agentId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/dream`);
export const webMcpAuditor = (agentId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/auditor`);
export const webMcpConnectAgent = (input: RegisterAgentInput) => webMcpRequest<Record<string, unknown>>('/agents', { method: 'POST', body: JSON.stringify(input) });
export const webMcpSetSkillStatus = (agentId: string, skillId: string, status: GatewaySkillItem['status']) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}/status`, { method: 'POST', body: JSON.stringify({ status }) });
export const webMcpTriggerDream = (agentId: string, preset: 'frugal' | 'balanced' | 'thorough' = 'balanced') => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/dream/trigger`, { method: 'POST', body: JSON.stringify({ preset, budget_usd: 0.1 }) });
export const webMcpAskAuditor = (agentId: string, message: string, clientRequestId: string) => webMcpRequest<Record<string, unknown>>(`/agents/${encodeURIComponent(agentId)}/auditor/chat`, { method: 'POST', body: JSON.stringify({ message, client_request_id: clientRequestId }) });

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchLiveAgentStatus(
  agentId: string,
  fields?: string[]
): Promise<GatewayAgentStatusResponse | null> {
  try {
    const params = new URLSearchParams({ agentId });
    if (fields && fields.length > 0) {
      params.append('fields', fields.join(','));
    }

    const res = await fetch(`${GATEWAY_URL}/v1/agent/status?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) {
      return null;
    }

    const data: GatewayAgentStatusResponse = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function fetchRecentTelemetry(agentId?: string): Promise<IngestedTraceEvent[]> {
  try {
    const url = agentId
      ? `${GATEWAY_URL}/v1/agent/telemetry?agentId=${encodeURIComponent(agentId)}`
      : `${GATEWAY_URL}/v1/agent/telemetry`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.traces || [];
  } catch {
    return [];
  }
}

export async function fetchUsageSummaries(): Promise<UsageSummary[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/usage-summary`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.summaries || [];
  } catch { return []; }
}

export async function fetchUsageSummary(agentId: string): Promise<UsageSummary | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/usage-summary`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary || null;
  } catch { return null; }
}

export async function fetchUsageDetail(agentId: string): Promise<{ detail: UsageDetail | null; error?: string }> {
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/usage-detail`, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return { detail: null, error: (await res.json().catch(() => ({}))).error || 'telemetry_unavailable' };
    const data = await res.json();
    return { detail: data.detail || null };
  } catch { return { detail: null, error: 'telemetry_upstream_unavailable' }; }
}

export async function fetchRegisteredAgents(): Promise<RegisteredAgentProjection[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents || [];
  } catch {
    return [];
  }
}

export async function fetchAgentSkills(agentId: string): Promise<GatewaySkillItem[] | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/skills`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()).skills || [];
  } catch { return null; }
}

export async function updateGatewaySkillStatus(agentId: string, skillId: string, status: GatewaySkillItem['status'], agentKey?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(agentKey ? { 'x-agent-key': agentKey } : {}) }, body: JSON.stringify({ status }) });
    const data = await res.json();
    return { ok: Boolean(data.ok), error: data.message || data.error };
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function fetchAgentActivity(): Promise<AgentActivityProjection[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/activity`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents || [];
  } catch {
    return [];
  }
}

export async function fetchFleetOverview(): Promise<FleetOverview | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/overview`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return { agents: data.agents || [], summary: data.summary || { registered: 0, online: 0, linked: 0, auditor_ready: 0 } };
  } catch { return null; }
}

export async function fetchWalletSnapshot(agentId: string): Promise<WalletSnapshot | null> {
  try { const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/wallet`, { signal: AbortSignal.timeout(4_000) }); if (!res.ok) return null; return (await res.json()).wallet || null; } catch { return null; }
}

export async function fetchAudits(agentId: string): Promise<AuditRun[]> {
  try { const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/audits`, { signal: AbortSignal.timeout(3_000) }); if (!res.ok) return []; return (await res.json()).audits || []; } catch { return []; }
}
export async function fetchDreamAuditJobs(agentId: string): Promise<DreamAuditJob[]> {
  try { const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/audits`, { signal: AbortSignal.timeout(3_000) }); if (!res.ok) return []; return (await res.json()).dream_jobs || []; } catch { return []; }
}
export async function fetchAuditorWorkspace(agentId: string, auditJobId: string): Promise<AuditorWorkspace | null> {
  try { const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/audits/${encodeURIComponent(auditJobId)}/workspace`, { signal: AbortSignal.timeout(4_000) }); if (!res.ok) return null; return (await res.json()).workspace || null; } catch { return null; }
}
export function auditorEventStreamUrl(agentId: string, auditJobId: string): string { return `${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/audits/${encodeURIComponent(auditJobId)}/events`; }
export async function askAuditor(agentId: string, auditJobId: string, message: string, clientRequestId: string): Promise<{ ok: boolean; turn?: AuditChatTurn; error?: string; message?: string }> {
  try { const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/audits/${encodeURIComponent(auditJobId)}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ message, client_request_id: clientRequestId }), signal: AbortSignal.timeout(15_000) }); const body = await res.json(); return { ok: Boolean(body.ok), turn: body.turn, error: body.error, message: body.message }; } catch { return { ok: false, error: 'gateway_unavailable' }; }
}

export async function registerAgent(input: RegisterAgentInput): Promise<{ ok: boolean; agent?: RegisteredAgentProjection; agentKey?: string; knowledgeSync?: KnowledgeSync; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok), agent: data.agent, agentKey: data.credential?.agent_key, knowledgeSync: data.knowledge_sync, error: data.message || data.error };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Gateway unavailable' };
  }
}

export async function claimAgent(input: ClaimAgentInput): Promise<{ ok: boolean; agent?: RegisteredAgentProjection; knowledgeSync?: KnowledgeSync; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agent/claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok), agent: data.agent, knowledgeSync: data.knowledge_sync, error: data.error || data.message };
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function submitTelemetryEvent(payload: {
  agent_id: string;
  task_id: string;
  model: string;
  tokens_consumed: number;
  tools_used?: string[];
  latency_ms?: number;
  status: 'success' | 'failed';
  summary?: string;
}) {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agent/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function linkDreamAgent(agentId: string, hypermoveAgentId: string): Promise<DreamLinkResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/link`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ hypermove_agent_id: hypermoveAgentId }) });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function fetchDreamReadiness(agentId: string): Promise<DreamReadinessResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/readiness`, { headers: { Accept: 'application/json' } });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function setupDreamAgent(agentId: string): Promise<DreamLinkResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function fetchDreamLessons(agentId: string): Promise<DreamLesson[]> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/lessons`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    if (!response.ok) return [];
    return (await response.json()).lessons || [];
  } catch { return []; }
}

export async function fetchDreamLessonProof(agentId: string, lessonId: string): Promise<DreamLessonProof | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/lessons/${encodeURIComponent(lessonId)}/0g-proof`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    return (await response.json()).proof || null;
  } catch { return null; }
}

export async function triggerDreamRun(agentId: string): Promise<DreamTriggerResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/trigger`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ preset: 'balanced', budget_usd: 0.1 }) });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function fetchDreamState(agentId: string): Promise<DreamStateResponse | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream`, { headers: { Accept: 'application/json' } });
    return await response.json();
  } catch { return null; }
}

export async function reconcileDreamRun(agentId: string): Promise<DreamTriggerResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/reconcile`, { method: 'POST', headers: { Accept: 'application/json' } });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export async function syncCompletedDreamRun(agentId: string): Promise<DreamTriggerResponse> {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/sync`, { method: 'POST', headers: { Accept: 'application/json' } });
    return await response.json();
  } catch (error: any) { return { ok: false, error: error.message || 'Gateway unavailable' }; }
}

export function dreamRunStreamUrl(agentId: string, runId: string): string {
  return `${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/dream/runs/${encodeURIComponent(runId)}/stream`;
}

export interface DreamDailyDigest {
  last_run_id?: string;
  duration_ms?: number;
  episodes_consolidated?: number;
  memories_added?: number;
  memories_pruned?: number;
  contradictions_resolved?: number;
  summary_narrative?: string;
}

export interface WakeContextResponse {
  ok: boolean;
  source?: 'live' | 'cache';
  cached_at?: string;
  warning?: string;
  upstream?: {
    agent_id?: string;
    active_constraints?: Array<{ type: string; content?: string; text?: string; constraint?: string }>;
    daily_digest?: string | DreamDailyDigest;
    system_prompt_injection?: string;
    skills_count?: number;
    memories_count?: number;
  };
  openx_constraints?: Array<{ type: string; content: string; lesson_id: string }>;
  effective_constraints?: Array<{ type: string; content?: string; text?: string; constraint?: string; lesson_id?: string }>;
  error?: string;
  message?: string;
}

export async function fetchWakeContext(agentId: string): Promise<WakeContextResponse | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agentId)}/wake`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
