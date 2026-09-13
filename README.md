# OpenX Agent Portal

OpenX Agent Portal is an AI-native management studio and operator control plane for autonomous AI agents, pairing an Express Gateway sidecar (`:7411`), a Next.js Operator Portal (`:3010`), and an autonomous agent worker.

## Portal Management Functions

- **Manage & Track Working Tasks:** Real-time visibility into agent task execution, progressive phases, working logs, and cryptographic artifact delivery.
- **Credit, Quota & Usage Metering:** Transparent tracking of per-agent token consumption, model pricing tiers, quota policies, and credit allocations.
- **Dream-Cycle & REM Cognitive Lessons:** Extract, replay, and retain strategic lessons learned from the agent's REM reflection loops for recursive self-improvement.
- **Verified Service Delivery:** Pluggable settlement, execution, and proof adapters let an operator attach verifiable service receipts without making the Portal native to a single payment rail or chain.

## Protocol-Agnostic Control Plane

OpenX keeps application concerns independent from any one chain, wallet, payment network,
or data provider. The Gateway owns adapter boundaries; the agent and Portal consume stable,
typed application contracts.

- **Data adapters:** The researcher owns upstream data access and provider credentials; it emits a normalized domain payload rather than exposing raw provider data.
- **Execution adapters:** A report commitment is prepared and verified against the selected execution network before it becomes proof-eligible. Wallet signing remains in the user's wallet or configured relayer boundary.
- **Proof adapters:** Receipt anchoring and Attestcoin verification are opt-in, configuration-gated capabilities. They add evidence to a report without changing the report, Portal, or data-pipeline contracts when disabled.
- **Operator APIs:** The Portal reads redacted status, tracking, report, and proof projections from the Gateway. Secrets, raw provider responses, and signing material do not cross this boundary.

## AI-Native Architecture & Code Structure

OpenX follows a clean, boundary-first architecture. The agent is the only component
that can use provider credentials and interpret raw protocol data; the Gateway is the
trusted validation and persistence boundary; and the Portal is a read-only operator
experience. This separation keeps The Graph credentials and raw payloads out of
browser responses while making a report reproducible and auditable.

```text
The Graph subgraphs                 OpenX research agent
(Aave v3 / Morpho Blue)  ──GraphQL──► fetches, normalizes, calculates risk
                                             │
                                             │ authenticated APSD-L report
                                             ▼
                                  Gateway: validate, hash, persist
                                  SQLite WAL statement_reports
                                             │
                         ┌───────────────────┴───────────────────┐
                         ▼                                       ▼
               public CaaS context API                 Operator Portal UI
               redacted prompt card + vector           statements, tasks, tracking
```

### The Graph data pipeline

The DeFi lending researcher reads configured The Graph subgraphs for Aave v3 and
Morpho Blue on Arbitrum. It requests a market snapshot plus a bounded history of
utilization observations, then normalizes protocol-specific fields into one telemetry
shape: provider, protocol, market, indexed block, timestamps, utilization, borrow and
supply rates, kink headroom, hourly utilization, and utilization volatility.

The agent treats GraphQL as an upstream data source, not as a public API dependency:

- Provider URLs and bearer keys remain in the agent runtime environment
  (`OPENX_GRAPH_*`); they are never persisted in a report or returned by the Gateway.
- Invalid, incomplete, timed-out, or unconfigured Graph data produces an explicit
  `degraded` telemetry status and reason. The researcher can still produce a truthful
  report from its safe fallback inputs; it never labels unavailable data as fresh.
- The Gateway never calls The Graph while serving context. It reads the already
  validated statement from SQLite, so public reads are fast, deterministic, and do not
  consume a provider credential.

### From research run to statement report

Each research run computes position risk from collateral and debt, including LTV,
health factor, utilization/kink headroom, volatility, and an allocation recommendation.
The hard 40% LTV gate is applied before a report can be submitted. The agent then builds
an APSD-L v2.1 canonical envelope, serializes it deterministically, and calculates a
SHA-256 `content_hash`. The envelope contains the normalized The Graph telemetry,
calculation/audit metadata, allocation vector, and a compact `decision_context_card`.

The agent sends that report with its agent credential to
`POST /v1/agents/:agentId/statements`. The Gateway applies strict schema and risk
validation, rejects conflicts, persists the accepted record in `statement_reports`, and
records it for agent knowledge/tracking. A public, finalized, non-failed report can then
be read through `GET /v1/agents/:agentId/context/defi-lending` or formatted for a
downstream prompt through `POST /v1/agents/:agentId/context/query`. Those public
projections contain the compact context card, freshness, risk vector, and hash/attestation
state — never a wallet address, raw provider response, or secret.

### Attestcoin verification

Attestcoin adds an asynchronous, independently verifiable proof journey to a submitted
statement; it is not required to generate or read a report. After a user-approved
statement commitment is confirmed, the Gateway validates the transaction, its sender,
target contract, and committed report hash. It derives a deterministic receipt hash and,
when the optional anchor relayer is configured, anchors that receipt on the configured
proof-source network.

With `OPENX_ATTESTCOIN_ENABLED=true`, the Gateway waits until the Attestcoin proof
builder has attested the anchor block, obtains the transaction inclusion proof, verifies
that the proof transaction matches the stored anchor, and calls the configured verifier
precompile. The resulting proof metadata and payload hash are persisted with the
statement execution. The Portal can therefore show a truthful lifecycle — pending
anchor, pending attestation, verified, unavailable, or failed — rather than treating an
asynchronous proof as an immediate guarantee. Pending proofs are retried automatically;
a disabled or unavailable proof adapter leaves the statement and its public context
available without asserting verification.

For the detailed schema, failure modes, and executable verification seams, see the
[The Graph CaaS PRD](docs/prd/012-the-graph-data-pipeline-agent-context-service.md) and
[system map](docs/features/the-graph-data-pipeline-agent-context-service-map.md).

```text
openx-portal/
├── agent/                  # Autonomous Agent Runtime
│   ├── main.py             # Agent execution entrypoint & task loops
│   ├── sync_agent.py       # Telemetry, heartbeats & working-log sync
│   └── gateway_client.py   # Gateway client (tasks, telemetry, reports)
├── gateway/                # Control Plane Sidecar (:7411)
│   ├── src/server.ts       # REST & telemetry endpoints
│   ├── src/db/             # Embedded SQLite schema & task/report ledgers
│   └── src/services/       # Agent registry, report/proof adapters, knowledge and lifecycle services
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
