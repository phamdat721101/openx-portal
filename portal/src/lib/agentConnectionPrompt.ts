const DEFAULT_GATEWAY_URL = 'http://localhost:7411';

export interface AgentConnectionPromptOptions {
  agentId?: string;
  gatewayUrl?: string;
}

export interface AgentConnectionEnvironment {
  gatewayUrl: string;
  label: 'Local development' | 'Deployed gateway';
}

export function getAgentConnectionEnvironment(gatewayUrl = process.env.NEXT_PUBLIC_OPENX_GATEWAY_URL): AgentConnectionEnvironment {
  const normalizedUrl = (gatewayUrl || DEFAULT_GATEWAY_URL).trim().replace(/\/$/, '');
  try {
    const hostname = new URL(normalizedUrl).hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    return { gatewayUrl: normalizedUrl, label: isLocal ? 'Local development' : 'Deployed gateway' };
  } catch {
    return { gatewayUrl: DEFAULT_GATEWAY_URL, label: 'Local development' };
  }
}

export function buildAgentConnectionPrompt({ agentId, gatewayUrl }: AgentConnectionPromptOptions = {}): string {
  const environment = getAgentConnectionEnvironment(gatewayUrl);
  const configuredAgentId = agentId || '<agent-id-returned-by-registration>';

  return `Connect this agent to the OpenX Portal (${environment.label}).

Gateway URL: ${environment.gatewayUrl}
Agent ID: ${configuredAgentId}

Configure OPENX_GATEWAY_URL and OPENX_AGENT_ID with the values above. Ask the operator to place the separately copied OPENX_AGENT_KEY in this agent's secret manager; never request, print, persist, or send that key in a prompt, log, telemetry payload, or URL.

After setup, report complete measured operational metadata through the existing OpenX Gateway contracts:
- Send task lifecycle telemetry for start, heartbeat, completion, and failure: task ID, safe title/category, current phase, progress, model, measured latency and token count when available, tool IDs, outcome, and a short sanitized summary.
- Send one idempotent usage event per completed task with observed model token dimensions, tool calls, skill invocations, and measured nim-skill savings. Omit unknown measurements instead of inventing zeroes or estimates.
- Send safe memory episodes and candidate-skill metadata only when available, and run the configured sync scheduler so the Portal can show connection and capability state.

Use only these safe metadata fields. Never send raw prompts, responses, tool arguments, command output, file contents, authorization headers, credentials, private keys, wallet secrets, or personal data. Treat Gateway outages as non-blocking to the underlying agent task and retry using the host's bounded retry policy.`;
}
