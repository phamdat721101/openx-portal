---
name: statement-tracking-researcher
description: Research allowlisted DeFi positions and push a canonical statement report to OpenX Gateway. Use for read-only position research; never execute, sign, or settle payments.
---

# Statement tracking researcher

Produce one APSD v1 report per run from configured, allowlisted Arbitrum lending,
Variational, and 1inch sources. 1inch is quote/pricing evidence only, never PnL.

1. Read agent identity and `OPENX_AGENT_KEY` from the host secret manager.
2. Record source chain, block, timestamp, finality, PnL methodology, and source failures.
3. Compute LTV from collateral/debt. Reject a report above 40%; recommend 32% or less.
4. Mark unavailable data `partial` or `failed`; do not invent values or attestations.
5. Canonicalize the JSON and calculate lowercase SHA-256 as `content_hash`.
6. Call `gateway_client.submit_statement_report(OPENX_AGENT_ID, report)`.

The Gateway validates, encrypts/archives the report in 0G, and owns all dashboard and
execution authority. Do not include API keys, wallet seeds, private keys, cookies, or
private strategy inputs in the report. Do not claim Creditcoin Attestcoin verification;
Gateway sets that status after its own verifier runs.
