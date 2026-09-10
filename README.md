# OpenX Agent Portal

OpenX Agent Portal is an AI-native management studio and operator control plane for autonomous AI agents, pairing an Express Gateway sidecar (`:7411`), a Next.js Operator Portal (`:3010`), and an autonomous agent worker.

## Portal Management Functions

- **Manage & Track Working Tasks:** Real-time visibility into agent task execution, progressive phases, working logs, and cryptographic artifact delivery.
- **Credit, Quota & Usage Metering:** Transparent tracking of per-agent token consumption, model pricing tiers, quota policies, and credit allocations.
- **Dream-Cycle & REM Cognitive Lessons:** Extract, replay, and retain strategic lessons learned from the agent's REM reflection loops for recursive self-improvement.
- **Pay-to-Use via XRPL Settlement & T54:** Auditable, on-chain micropayment settlement on the XRP Ledger (RLUSD) using [Trust Lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-lines/) and [Multi-Purpose Tokens (MPT)](https://xrpl.org/docs/concepts/tokens/mpt/), signed securely via the [n-payment](https://github.com/phamdat721101/n-payment) MCP wallet bridge, and relayed through [HyperMove MCP](https://www.hypermove.xyz/).

## XRPL Technologies & Core Integrations

OpenX Agent Portal natively integrates XRP Ledger standards and modular agent services:

### 1. XRP Ledger (XRPL) Technologies
- **[XRPL Trust Lines](https://xrpl.org/docs/concepts/tokens/fungible-tokens/trust-lines/):** Explicit bidirectional trust relationships enabling accounts to hold and settle issued fungible currencies (such as RLUSD stablecoins) with custom limits and authorized counterparty controls.
- **[Multi-Purpose Tokens (MPT)](https://xrpl.org/docs/concepts/tokens/mpt/):** Next-generation unidirectional XRPL token standard (XLS-33d / DynamicMPT) providing scalable asset tracking, compact on-chain metadata, and built-in institutional compliance features.
- **[RLUSD Stablecoin Settlement](https://xrpl.org/docs/concepts/tokens/fungible-tokens/):** Institutional-grade fiat-backed issued currency on XRPL utilized for deterministic, quote-bound pay-to-use agent service payments.
- **[XRPL AMM (XLS-30)](https://xrpl.org/docs/concepts/tokens/decentralized-exchange/automated-market-makers/):** On-chain Automated Market Maker protocol for observing liquidity depth, orderbook dynamics, and token settlement paths.
- **[xrpl.js](https://xrpl.org/docs/references/protocol-reference/):** Official ledger client library for cryptographic transaction verification, ledger consensus checks, and receipt auditing.

### 2. Wallet Service & Key Isolation
- **[n-payment](https://github.com/phamdat721101/n-payment) (`https://github.com/phamdat721101/n-payment`):** Local-first MCP stdio wallet daemon and XRPL signing service. The OpenX Agent Gateway interfaces with `n-payment` via standard Model Context Protocol tool invocations (`xrpl_pay`, `xrpl_trust_set`), guaranteeing non-custodial key isolation—the `XRPL_SEED` stays strictly inside the host machine environment and is never exposed to Gateway memory, request/response payloads, or network logs.

### 3. Facilitator & Telemetry Network
- **[HyperMove MCP](https://www.hypermove.xyz/) (`https://www.hypermove.xyz/`):** Facilitator relay and agent telemetry infrastructure powered by HyperMove, providing upstream quote generation, telemetry verification, and execution monitoring.

## AI-Native Architecture & Code Structure

```text
xrpl-openx-portal/
├── agent/                  # Autonomous Agent Runtime
│   ├── main.py             # Agent execution entrypoint & task loops
│   ├── sync_agent.py       # Telemetry, heartbeats & working-log sync
│   └── gateway_client.py   # Gateway client (tasks, telemetry, settlements)
├── gateway/                # Control Plane Sidecar (:7411)
│   ├── src/server.ts       # REST & telemetry endpoints
│   ├── src/db/             # Embedded SQLite schema & task/settlement ledgers
│   └── src/services/       # Agent registry, XRPL settlement (Trustlines/MPTs), n-payment MCP bridge, Dream/HyperMove client
├── portal/                 # Operator Studio (:3010)
│   ├── src/app/            # Next.js App Router (Studio hub, agent tabs, docs)
│   ├── src/components/     # Dashboards (Dream-Cycle, Tasks, Skills, Wallet)
│   └── src/lib/            # Portal context, auth & gateway RPC client
├── docs/                   # System maps, architectural specs & PRDs
└── .nim/                   # Reliability harness: lessons store & delivery contracts
```

## Run Locally

Requirements: Node.js 18+ and npm. Python 3.11+ is needed only for the optional agent worker.

Install dependencies and start the Gateway and Portal in separate terminals:

```bash
npm --prefix gateway install
npm --prefix portal install
npm --prefix gateway run dev
```

```bash
npm --prefix portal run dev
```

- Portal: http://localhost:3010
- Gateway health: http://localhost:7411/health

To run the example connected agent, copy its environment template, set `OPENX_AGENT_KEY`, and run:

```bash
cd agent
python3 main.py
```

*Alternative launcher:* `./start.sh` installs missing dependencies, builds both services, and replaces processes on ports 3010 and 7411.

## Checks

```bash
npm --prefix gateway test
npm --prefix gateway run build
npm --prefix portal run typecheck
```
