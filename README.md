# openx-deep-research-analyst

Google "All Things Agentic" Hackathon submission (Enterprise Applications track). A Gemini
3.5 / Google ADK orchestrator that performs long-horizon DeFi market research, autonomously
paying for gated premium data via XRPL x402 micropayments.

**Source PRD:** [`../../biz-team/bd-team/research/openx/gg-agentic-plan.md`](../../biz-team/bd-team/research/openx/gg-agentic-plan.md)

## Architecture — two-language monorepo

```
openx-deep-research-analyst/
├── agent/       ← Python, Google ADK + Gemini 3.5 orchestration loop + gws CLI tool
└── gateway/     ← Node/TS, wraps HyperMove MCP + nim-skill + n-payment as a local HTTP sidecar
```

**Why two languages:** Google ADK is Python-native. `nim-skill`, `n-payment`, and HyperMove
MCP are all TypeScript/Node — and HyperMove MCP in particular is architecturally a server
other things call (see [`~/.kiro/steering/hypermove-mcp-xrpl.md`](../../.kiro/steering/hypermove-mcp-xrpl.md)
for the reference architecture), not a library meant to be imported into Python. `agent/`
calls `gateway/` over local HTTP; `gateway/` is the only process that ever touches the
Node-side dependencies.

## Current scope — Phase 1 skeleton only

Per the PRD's own 14-day sprint (Section 6), this scaffold covers **Phase 1 (Days 1-4):
environment + core ADK setup**. Phase 2 (MCP/payment gateway wiring), Phase 3 (the demo
scenario), and Phase 4 (Devpost polish) are explicitly **not yet built** — see each phase's
stub files for `# TODO: Phase N` markers pointing back to the PRD sections they implement.

| Phase | PRD section | Status |
|---|---|---|
| 1 — Environment & Core ADK Setup | §6 Days 1-4 | ✅ this scaffold |
| 2 — Gateway & MCP Integration | §6 Days 5-8 | ⬜ not started |
| 3 — "Busy Work" Demo Scenario | §6 Days 9-11 | ⬜ not started |
| 4 — Devpost Polish & Submission | §6 Days 12-14 | ⬜ not started |

## Quickstart (Phase 1)

```bash
# agent/ (Python)
cd agent && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 main.py   # runs the ADK orchestration loop stub

# gateway/ (Node, separate terminal)
cd gateway && npm install
npm run dev        # starts the local MCP-sidecar stub on :7411
```

## Cross-references

- PRD source: `research/openx/gg-agentic-plan.md` (bd-team workspace)
- HyperMove MCP architecture: `~/.kiro/steering/hypermove-mcp-xrpl.md`
- Sibling OpenX product (unrelated, do not confuse): `../fhe-ai-context/`
