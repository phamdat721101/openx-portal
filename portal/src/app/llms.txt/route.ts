import { NextResponse } from 'next/server';

export async function GET() {
  const markdown = `# OpenX Agent Ecosystem — Machine-Readable Specification (llms.txt)
> Version: 1.0.0
> Target: Autonomous AI Agents, Google ADK Orchestrators, and LLM Consumers
> Gateway Base URL: http://localhost:7411 (Configurable via OPENX_GATEWAY_URL)
> Portal Base URL: http://localhost:3010

---

## 1. Overview
OpenX Deep Research Analyst is an autonomous agent infrastructure combining:
1. Google ADK (Agent Development Kit) & Gemini 3.5 for deep market intelligence.
2. Core Gateway Sidecar (:7411) for zero-dependency agent self-introspection, telemetry ingestion, and cognitive memory.
3. XRPL x402 Micropayment Rail for decentralized RLUSD settlement.
4. Agent Studio Hub (:3010) for human-in-the-loop operator oversight and Dream Cycle learning.

---

## 2. Agent Introspection API (Read Path)

### GET /v1/agent/status
Retrieves 5 core operational domains for an agent in a single round-trip.

**Endpoint:** \`http://localhost:7411/v1/agent/status?agentId=<uuid>&fields=info,status,model,credits,memory\`

**Headers:**
- \`Accept: application/json\`
- \`x-erc8004-agent-id\`: (Optional) On-chain ERC-8004 agent identifier.
- \`Authorization\`: (Optional) Bearer token for credit balance queries.

**Response Schema (JSON):**
\`\`\`json
{
  "ok": true,
  "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "requested_at": "2026-08-22T13:30:00Z",
  "info": {
    "slug": "gws-defi-analyst",
    "name": "DeFi Research Analyst",
    "owner_address": "0x8f3C785B0B2E6A17e914041b312bBc92651B5A44",
    "erc8004": { "verified": true, "agent_uri": "https://openx.ai/agents/defi-analyst.json", "reason": null }
  },
  "status": {
    "reachable": true,
    "last_health_check_at": "2026-08-22T13:30:00Z",
    "rate_limited": false,
    "error": null
  },
  "model": {
    "configured_model": "gemini-3.5",
    "packages": [{ "kit_slug": "google-workspace-cli", "capability_ids": ["sheets.read", "docs.write"] }]
  },
  "credits": {
    "balance_usdc": "42.100000",
    "consumed_usdc_mtd": "8.500000",
    "welcome_granted": true,
    "reason": null
  },
  "memory": {
    "episodes": 128,
    "facts": 340,
    "skills": 4,
    "activity_14d": [0, 2, 4, 1, 0, 5, 8, 3, 2, 4, 6, 9, 2, 1],
    "last_query_at": "2026-08-22T13:28:00Z"
  }
}
\`\`\`

---

## 3. Agent Submission APIs (Write / Ingestion Path)

### POST /v1/agent/telemetry
Submits execution traces, token consumption, latency, and tool invocations.

**Endpoint:** \`http://localhost:7411/v1/agent/telemetry\`
**Payload:**
\`\`\`json
{
  "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "task_id": "task_defi_yield_analysis_001",
  "model": "gemini-3.5",
  "tokens_consumed": 1420,
  "tools_used": ["google-workspace-cli.sheets.read"],
  "latency_ms": 680,
  "status": "success",
  "cost_usdc": "0.014",
  "summary": "Completed competitive yield scan across 3 DeFi protocols."
}
\`\`\`

### POST /v1/agent/memory/episode
Submits newly synthesized research episodes, facts, and insights to the Cognitive Brain.

**Endpoint:** \`http://localhost:7411/v1/agent/memory/episode\`
**Payload:**
\`\`\`json
{
  "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "episode_type": "protocol_research",
  "summary": "Uniswap v3 liquidity depth concentrated in 0.05% fee tier",
  "facts_count": 3,
  "confidence": 0.95,
  "entities": ["Uniswap v3", "Aave v3", "Curve"]
}
\`\`\`

### POST /v1/agent/skills/candidate
Submits newly synthesized reusable analysis skills for human or REM consolidation review.

**Endpoint:** \`http://localhost:7411/v1/agent/skills/candidate\`
**Payload:**
\`\`\`json
{
  "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "skill_slug": "uniswap-fee-yield-estimator",
  "display_name": "Uniswap v3 Yield Estimator",
  "capability_ids": ["defi.yield_calc", "sheets.write"],
  "code_template": "def calculate_yield(tvl, volume_24h, fee_tier): ..."
}
\`\`\`

---

## 4. XRPL x402 Micropayment Rail (Phase 2)

### GET /v1/supplier/defi?feedId=<feed_id>
Requests premium gated DeFi feeds. When unpaid, returns HTTP 402 challenge:
\`\`\`http
HTTP/1.1 402 Payment Required
WWW-Authenticate: x402 address="rLusdWalletAddressXYZ", amount="0.05", currency="RLUSD", network="xrpl-testnet"
\`\`\`

---

## 5. Python Client Example (Zero-Dependency)

\`\`\`python
import urllib.request
import json

def report_task(agent_id: str, task_id: str, tokens: int, tools: list):
    payload = {
        "agent_id": agent_id,
        "task_id": task_id,
        "model": "gemini-3.5",
        "tokens_consumed": tokens,
        "tools_used": tools,
        "latency_ms": 520,
        "status": "success"
    }
    req = urllib.request.Request(
        "http://localhost:7411/v1/agent/telemetry",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))
\`\`\`
`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
