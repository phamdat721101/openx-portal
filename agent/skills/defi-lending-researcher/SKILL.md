---
name: defi-lending-researcher
description: Autonomous DeFi lending researcher for monitoring Aave v3, Morpho Blue, Compound v3, and Fluid protocols, auditing LTV & liquidation risk, and publishing verified reports to OpenX Portal.
version: 1.0.0
author: phamdat721101 (OpenX Portal)
license: MIT
tier: specialized
when_to_use: |
  - Audit DeFi lending and borrowing health across Arbitrum and Ethereum protocols.
  - Compute LTV (debt/collateral) and verify compliance against the strict 40% maximum risk cap.
  - Generate Gateway-verifiable canonical APSD-L v2.1 statement reports with SHA-256 content hashes.
  - Stream multi-phase task execution logs to OpenX Gateway for real-time portal monitoring.
  - Archive position snapshots and market episodes into decentralized 0G storage.
---

# DeFi Lending Researcher

The `defi-lending-researcher` skill provides autonomous, verifiable research capabilities for decentralized lending markets. It couples quantitative risk modeling (LTV, Health Factor, Utilization Curves, Liquidation Boundaries) with the OpenX Gateway ingestion protocol.

## Protocol Coverage

- **Aave v3**: Multi-reserve collateralized borrowing, eMode risk configurations, variable rate dynamics.
- **Morpho Blue**: Isolated lending markets, configurable LLTV (Loan-to-Value) liquidation ratios, permissionless oracles.
- **Compound v3 (Comet)**: Single-borrowable asset pools with multi-asset non-rehypothecated collateral.
- **Fluid**: High-efficiency isolated liquidity layers with dynamic automated debt caps.

## Risk Engine Disciplines

1. **LTV Boundary**:
   $$\text{LTV} = \frac{\text{Debt}_{\text{USD}}}{\text{Collateral}_{\text{USD}}}$$
   - **Hard Cap ($0.40$)**: Positions with $\text{LTV} > 40\%$ are rejected and flagged as `CRITICAL_EXCEEDS_CAP`.
   - **Target Safe Operating Threshold ($0.32$)**: Positions between $32\%$ and $40\%$ are flagged as `ELEVATED_RISK`.
   - **Optimal Zone ($\le 32\%$)**: Flagged as `CONSERVATIVE_SAFE`.

2. **Health Factor**:
   $$\text{HF} = \frac{\text{Collateral}_{\text{USD}} \times \text{Liquidation Threshold}}{\text{Debt}_{\text{USD}}}$$
   - Must maintain $\text{HF} \ge 1.50$ for conservative stability.

3. **Deterministic Hashing and Learning**:
   The APSD-L v2.1 envelope uses sorted JSON, fixed decimal strings, and integer basis points before SHA-256 hashing. Gateway recomputes the hash before archival or Creditcoin-compatible commitment. Read the preceding statement to report risk-regime changes, but never infer telemetry that a source did not provide.

## Execution Architecture

```
[Agent Worker]
      │
      ├─► 1. Query Reserve / Position Telemetry (Arbitrum / Ethereum)
      ├─► 2. Run Position Risk Audit (LTV <= 40%, HF >= 1.5)
      ├─► 3. Synthesize Canonical APSD v1 Report & SHA-256 Hash
      │
      └─► [OpenX Gateway Sidecar :7411]
                │
                ├─► TaskReporter: Real-time working log stepper
                ├─► POST /v1/agents/:id/statements: Stored in SQLite & 0G Storage
                ├─► POST /v1/agent/memory/episode: Archived in REM Cognitive Memory
                └─► POST /v1/agent/skills/candidate: Registered in Agent Skills Catalog
```

## Integration Commands

```bash
# Run single position analysis
python defi_lending_researcher.py --venue "Morpho Blue (Arbitrum)" --collateral 25000 --debt 7000

# Full market sweep across all allowlisted venues
python defi_lending_researcher.py --scan-all

# Verify via test suite
python -m unittest discover -s tests
```
