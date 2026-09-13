---
name: statement-tracking-researcher
description: Research Morpho Blue and Aave v3 Arbitrum positions through configured The Graph sources, then push canonical APSD-L v2.1 reports to OpenX Gateway. Use for read-only position research; never execute, sign, or settle payments.
version: 1.0.0
author: phamdat721101 (OpenX Portal)
license: MIT
tier: specialized
---

# Statement Tracking Researcher

Autonomous research skill for monitoring allowlisted DeFi lending protocols (Aave v3, Morpho Blue, Compound v3, Fluid) on Arbitrum and Ethereum, auditing Loan-To-Value (LTV) exposure, generating canonical APSD v1 statements, and reporting them to OpenX Gateway for real-time portal visualization and decentralized 0G storage archival.

## Core Rules & Guardrails

1. **Read-Only Intelligence**: Never execute transactions, sign messages, transfer assets, or approve spend allowances. The connected browser wallet (Privy) remains the sole signing authority for commitments.
2. **Strict LTV Risk Cap**:
   - Compute `LTV = debt_usd / collateral_usd`.
   - **Hard Cap**: Reject any position with `LTV > 40.0%` (`0.40`).
   - **Recommended Ceiling**: Flag and advise rebalancing when `LTV > 32.0%` (`0.32`).
3. **Health Factor Audit**:
   - Compute `Health Factor = (collateral_usd * liquidation_threshold_pct) / debt_usd`.
   - Require `Health Factor >= 1.5` for conservative status.
4. **Canonical Hashing**:
   - Serialize statement payload with sorted keys and minimal separators `json.dumps(..., sort_keys=True, separators=(',', ':'))`.
   - Calculate lowercase 64-hex SHA-256 string as `content_hash`.
5. **No Secret Leakage**:
   - Never include API keys, seed phrases, private keys, cookies, or internal strategy inputs in statements or logs.
6. **No Attestation Fabrication**:
   - Do not claim Creditcoin Attestcoin verification. Gateway and CC3 Testnet anchors handle proof verification post-submission.

## Indexed v1 venues

| Venue | Chain | Asset Pair | Oracle Anchor | Base LTV | Liq. Threshold |
|---|---|---|---|---|---|
| **Aave v3 (Arbitrum)** | Arbitrum One | WETH / USDC | Chainlink Composite | 80.0% | 82.5% |
| **Morpho Blue (Arbitrum)** | Arbitrum One | wstETH / USDC | Chainlink / Redstone | 86.0% | 91.5% |
Only Morpho Blue and Aave v3 have The Graph adapters in this skill. Other allowlisted audit fixtures must emit `degraded` telemetry and are not public CaaS sources.

## Workflow Steps

1. **Identity & Auth**: Read `OPENX_AGENT_ID`, `OPENX_AGENT_KEY`, and `OPENX_GATEWAY_URL` from environment or secret manager.
2. **Market Telemetry Ingestion**: Select the configured Morpho or Aave endpoint and market/reserve ID. Validate the GraphQL response, indexed observations, and hourly samples. If configuration or upstream data is unavailable, set `status: "degraded"` with a bounded reason; never label fallback data `ok`.
3. **Position Audit**:
   - Calculate `collateral_usd` and `debt_usd`.
   - Calculate `ltv` and `health_factor`.
   - Verify `ltv <= 0.40`. If exceeded, reject the report immediately.
4. **Canonical APSD-L v2.1 Statement Synthesis**:
   - Generate UUID v4 `report_id`.
   - Build canonical JSON structure.
   - Build the versioned canonical envelope using fixed decimal strings and integer basis points, then compute its 64-char SHA-256 `content_hash`.
   - Include telemetry quality/provenance, utilization/kink vector, oracle/DEX divergence, PnL attribution, risk audit, and a non-secret ≤110-token decision card.
   - Treat `degraded` telemetry as an explicit data-quality state; never invent missing snapshots or claim an Attestcoin proof.
5. **Learning Loop**:
   - Read the latest statement before comparing a new observation; summarize regime/risk changes in REM memory.
   - The research agent may recommend a deleverage review but never prepares, signs, approves, or broadcasts an order.
5. **Gateway Archival & Reporting**:
   - Initialize `TaskReporter` to push ordered working-logs (`evaluating_lending_markets`, `auditing_position_ltv`, `synthesizing_canonical_statement`).
   - Call `gateway_client.submit_statement_report(agent_id, report)` using the existing `x-agent-key` transport to persist in `statement_reports`.
   - Call `gateway_client.submit_memory_episode(agent_id, ...)` to register cognitive insight in REM memory.
   - Call `gateway_client.submit_candidate_skill(agent_id, ...)` to register skill in Gateway catalog.

## CLI Usage

```bash
# Run local position audit and submit to Gateway
python defi_lending_researcher.py --venue "Aave v3 (Arbitrum)" --collateral 15000 --debt 4200 --wallet 0x123FC5C0B2dBa03284BA259879E531DE59d0d1b3

# Run in dry-run mode (local calculation only, zero network writes)
python defi_lending_researcher.py --dry-run --collateral 10000 --debt 2800

# Scan all allowlisted lending venues
python defi_lending_researcher.py --scan-all

# Execute research mode from main orchestrator
python main.py --defi-research
```

## Statement Schema Reference

```json
{
  "report_id": "72f10a14-ed32-4ad4-b0a9-107ce68c672a",
  "content_hash": "d5ae481a6655de1ccbc8e46f4d9ce0f93695d119af4d737bce03ff3f1d22618c",
  "visibility": "public",
  "source_chain": "arbitrum",
  "source_block": "250100200",
  "source_timestamp": "2026-09-10T12:00:00.000Z",
  "finality": "finalized",
  "wallet_address": "0x123FC5C0B2dBa03284BA259879E531DE59d0d1b3",
  "venue": "Aave v3 (Arbitrum)",
  "collateral_usd": 12500.0,
  "debt_usd": 3500.0,
  "realized_pnl_usd": 0.0,
  "unrealized_pnl_usd": 0.0,
  "pnl_methodology": "Mark-to-market NAV audit on Aave v3 (Arbitrum).",
  "status": "received",
  "summary": "Aave v3 position: Collateral $12,500 vs Debt $3,500. LTV 28.00% (Cap: 40%). Health factor 2.95.",
  "attestation": {
    "status": "pending",
    "chain": "arbitrum"
  }
}
```
