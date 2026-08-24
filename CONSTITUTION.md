# Constitution — OpenX Deep Research Analyst

## Tech Stack and Tooling

- **Agent Orchestrator (`agent/`)**:
  - Runtime: Python 3.11+
  - Core Framework: Google ADK (Agent Development Kit), Gemini 3.5 / Flash model orchestration
  - Workspace Integration: Google Workspace CLI (`@googleworkspace/cli` / `gws`) for Sheets and Docs
  - Test & Run Command: `cd agent && python3 -m pytest tests/` / `python3 main.py`

- **MCP & Micropayment Gateway Sidecar (`gateway/`)**:
  - Runtime: Node.js 18+, TypeScript 5+
  - Framework: Express sidecar listening on port 7411
  - Integrations: HyperMove MCP client, `n-payment` (XRPL x402 settlement on RLUSD testnet), `nim-skill` runtime (`runHarnessed`, `verifyOrHeal`)
  - Test & Run Command: `cd gateway && npm test` / `npm run dev`

- **Analyst Portal & Studio (`portal/`)**:
  - Runtime: Next.js 14+ (App Router), React 19, TypeScript
  - Styling & Design System: Tailwind CSS, OpenX Design System
  - Capabilities: Agent management, Dream Cycle visualization, Credit Model, Skills inventory, Wallet connection, research trace inspection
  - Test & Run Command: `cd portal && npm run build` / `npm run dev`

- **Reliability Harness (`nim-skill`)**:
  - Verification & Enforcer: Strict output validation (`nonempty`, `json`, `schema`, `test`, `lint`, `evidence`)
  - Memory & Lessons: Local cache (`.nim/memory-cache.jsonl`) and failure log (`.nim/lessons.jsonl`)
  - Subprocess Compaction: `nim-logcompact` (`errors-only`, maxLines: 50)
  - Workrule Discipline: WR-01..WR-07 compliance with tracked memory in `.nim/agent-support-log.md`

## Architectural Invariants

1. **Two-Language Monorepo Boundary**:
   - `agent/` (Python) is strictly an HTTP client to `gateway/` (`http://localhost:7411`). Python code NEVER imports Node dependencies directly.
   - `gateway/` (TypeScript) is the single owner of MCP execution, XRPL x402 negotiations, and `nim-skill` verification.
   - `portal/` (Next.js) consumes mock or live agent/gateway APIs without mixing backend runtime assumptions.

2. **Data-Model & Schema Locations**:
   - Agent orchestration schemas: `agent/tools/` and `agent/gateway_client.py`
   - Gateway challenge/response schemas: `gateway/src/` (conforming to PRD §4.3 x402 challenge shape)
   - Portal types & mock data: `portal/src/lib/types.ts` and `portal/src/lib/mockData.ts`

3. **No Unverified External State Claims**:
   - External data retrieved via paid/free sources must pass evidence checks with a valid source attribution.
   - Self-reported success without proof is rejected by `nim-enforcer`.

4. **Context & Ecosystem Isolation**:
   - This workspace is strictly dedicated to **OpenX Deep Research Analyst** (Google ADK + Gemini 3.5 orchestration, HyperMove MCP telemetry, and XRPL x402 RLUSD micropayments).
   - External chain protocols, gasless EVM L2s, or other product dashboards must not be imported or mixed into this workspace.

## Agentic Contract

- Keep application behavior, infrastructure boundaries, and data ownership explicit in each feature brief.
- Before ending, being interrupted, or switching tasks, append a structured handoff to `docs/state/active_session.md`.
- Read this constitution, the relevant feature brief, and the final handoff snapshot before starting work.
- Maintain WR-01..WR-07 working rules and record token/context savings and caught errors in `.nim/agent-support-log.md`.

## Definition of Done

- Feature acceptance criteria pass.
- Relevant tests and verification commands (`npm test`, `pytest`, `npm run build`) pass.
- The final handoff snapshot records outcome, blockers, attempted solutions, and next steps.
- Tracked memory log (`.nim/agent-support-log.md`) is updated.
