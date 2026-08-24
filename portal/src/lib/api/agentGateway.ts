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
  credits?: {
    balance_usdc: string | null;
    consumed_usdc_mtd: string | null;
    welcome_granted: boolean | null;
    reason: string | null;
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
  cost_usdc?: string;
  summary?: string;
  received_at: string;
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
}

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_OPENX_GATEWAY_URL || 'http://localhost:7411';

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

export async function registerAgent(input: RegisterAgentInput): Promise<{ ok: boolean; agent?: RegisteredAgentProjection; agentKey?: string; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/v1/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return { ok: Boolean(data.ok), agent: data.agent, agentKey: data.credential?.agent_key, error: data.message || data.error };
  } catch (error: any) {
    return { ok: false, error: error.message || 'Gateway unavailable' };
  }
}

export async function submitTelemetryEvent(payload: {
  agent_id: string;
  task_id: string;
  model: string;
  tokens_consumed: number;
  tools_used?: string[];
  latency_ms?: number;
  status: 'success' | 'failed';
  cost_usdc?: string;
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
