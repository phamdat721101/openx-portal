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

  return `Connect and synchronize this agent with the OpenX Portal (${environment.label}).

Gateway URL: ${environment.gatewayUrl}
Agent ID: ${configuredAgentId}

1. Register or restore identity
- If Agent ID is a placeholder, ask the operator to use OpenX Portal → Connect Agent (or call POST /v1/agent/register) once. Public self-service registration accepts display_name, slug, model, capabilities, host_type, and optional wallet_address (EVM 0x... or XRPL classic r... address).
- Retain the returned agent ID and one-time key only in the agent host's secure environment file or secret manager.
- Configure OPENX_GATEWAY_URL and OPENX_AGENT_ID with the values above. Ask the operator to place the separately copied OPENX_AGENT_KEY in the secret manager; never request, print, persist, or send that key in a prompt, log, telemetry payload, or URL.

2. Connect and prove the first sync
- Call POST /v1/agent/sync with this agent ID, declared model, tool IDs, skill IDs, and plan ID (header x-agent-key: \${OPENX_AGENT_KEY}). This flips agent status from offline to online. Do not invent capabilities.
- Start one real task. First send POST /v1/agent/telemetry with task_state=started, then append ordered, redacted working-log events to POST /v1/agents/:agentId/tasks/:taskId/working-log for start, phase changes (planning -> research -> analysis -> verification -> delivery), and completion or failure.
- Verify the result through GET /v1/agents/:agentId/tasks/:taskId and report only whether the capability sync and task timeline were accepted. Do not fabricate a successful sync when Gateway is unavailable.

3. Continue safe operational synchronization
- Send task lifecycle telemetry for start, heartbeat, completion, and failure: task ID, safe title/category, current phase, progress, model, measured latency and token count when available, tool IDs, outcome, and a short sanitized summary.
- Send one idempotent usage event per completed task to POST /v1/agent/usage-events with observed model token dimensions, tool calls, skill invocations, and measured nim-skill savings. Omit unknown measurements instead of inventing zeroes or estimates.
- Send safe memory episodes to POST /v1/agent/memory/episode and candidate-skill metadata to POST /v1/agent/skills/candidate only when available, and run the configured sync scheduler so the Portal can show live connection, credit economics, and capability state.

4. Sync on-chain settlement transactions
- When executing or receiving on-chain micropayments or x402 quotes on XRPL (e.g. RLUSD, XRP settlement, or Dream Cycle execution receipts), sync the validated settlement record via POST /v1/agents/:agentId/settlements (header x-agent-key: \${OPENX_AGENT_KEY}).
- Provide transaction_hash (64-character hex), quote_id, amount, currency, merchant_address, facilitator_node, and network ("xrpl-testnet"). This populates the verified on-chain settlement ledger on the Dream Cycle page with live XRPL Testnet Explorer links.

5. Verification checklist
- Confirm successful connection and data ingestion with these read-only checks:
  1. GET \${OPENX_GATEWAY_URL}/health
  2. GET \${OPENX_GATEWAY_URL}/v1/agents/\${OPENX_AGENT_ID}
  3. GET \${OPENX_GATEWAY_URL}/v1/agents/\${OPENX_AGENT_ID}/activity
  4. GET \${OPENX_GATEWAY_URL}/v1/agents/\${OPENX_AGENT_ID}/tasks
  5. GET \${OPENX_GATEWAY_URL}/v1/agents/\${OPENX_AGENT_ID}/usage-detail
  6. GET \${OPENX_GATEWAY_URL}/v1/settlement/history?agent_id=\${OPENX_AGENT_ID}

Use only these safe metadata fields. Never send raw prompts, responses, tool arguments, command output, file contents, authorization headers, credentials, private keys, wallet secrets, or personal data. Treat Gateway outages as non-blocking to the underlying agent task and retry using the host's bounded retry policy. Preserve failed working-log events in the host's protected local spool for a later replay.`;
}
