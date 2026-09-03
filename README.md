# 🌐 OpenX Portal — AI Agent Management & Orchestration Platform

OpenX Portal is the unified mission control and execution harness for autonomous AI agents. Built as a high-performance, two-language monorepo, it pairs a Next.js 14 management studio with a Node.js/TypeScript gateway sidecar and Python Google ADK orchestrator. OpenX Portal empowers operators to monitor agent fleets, track granular token and tool credit consumption, inspect skill execution, run biological-inspired Dream Cycles with REM lesson consolidation, conduct autonomous security and reliability audits, and settle compute micropayments via HyperMove MCP and XRPL x402 RLUSD.

---

## 📑 Table of Contents

- 🌟 Core Capabilities
- 🏗️ Monorepo Architecture & Project Structure
- 🤖 Agent Fleet Management & Observability
- 💳 Credit Consumption Tracking & Usage Ledger
- 🛠️ Skills & Tool-Calling Registry
- 🧠 Dream Cycle & REM Memory Consolidation
- 🛡️ Autonomous Auditor Agent Architecture
- 🔌 HyperMove MCP Integration & XRPL Settlement
- 💾 Data Layer & Persistence Architecture
- 🚀 Quickstart & Development Guide

---

## 🌟 Core Capabilities

- 🤖 **Fleet-Wide Agent Orchestration**: Centralized registration, live heartbeat detection, and lifecycle stage tracking across heterogeneous agent hosts (Kiro CLI, Claude Code, Python Google ADK).
- 💳 **Micro-Precision Credit & Token Accounting**: Real-time metering of Gemini input, output, cached input, and reasoning tokens, paired with tool-call fees, allowance budgets, and overage tracking.
- 🛠️ **Skill Telemetry & Dynamic Tool Governance**: Deep visibility into agent skills, invocation success/failure rates, execution latency, and automated sandbox inspection.
- 🧠 **REM Dream Cycles & Sleep Memory Consolidation**: Periodic cognitive synthesis turning raw session episodes into persistent lessons, wake-up morning briefs, and production-ready promoted skills.
- 🛡️ **Autonomous Auditor Agent**: Evidence-backed agent verification powered by 0G Compute LLM audits and interactive citation-grounded operator chat.
- 🔌 **HyperMove MCP & XRPL x402 Micropayments**: Native Model Context Protocol (MCP) gateway with AES-256-GCM encrypted credential vault and cryptographic RLUSD micropayment settlement.
- 🗄️ **Zero-Friction Decentralized Archival**: Cryptographic anchoring of agent memories, telemetry, and audit proofs to 0G Storage with Merkle validation.

---

## 🏗️ Monorepo Architecture & Project Structure

OpenX Portal enforces a clean multi-tier boundary where specialized runtimes own their respective domain strengths:

- 💻 **`portal/` (Analyst Studio & Web Interface)**
  - Next.js 14 App Router with React 18, TypeScript, and Tailwind CSS.
  - Interactive operator views: Fleet Overview, Agent Detail, Credit Model, Skills Inventory, Dream Cycle Visualizer, Auditor Console, and Wallet Manager.
  - Reactive state management via `portalContext.tsx` with live hydration and optimistic updates.
  - WebMCP client tools enabling direct browser-to-agent tool calling.

- ⚡ **`gateway/` (Core API, MCP Bridge & Persistence Sidecar)**
  - Express sidecar listening on `http://localhost:7411`.
  - Single owner of database persistence, secret vaults, HyperMove MCP communication, XRPL x402 payment negotiation, and 0G Storage synchronization.
  - Built with TypeScript 5, `better-sqlite3` WAL database, and strict Zod runtime contract validation.
  - Full test coverage powered by Vitest and Supertest.

- 🐍 **`agent/` (Python Autonomous Orchestrator)**
  - Python 3.11+ runtime powered by Google ADK (Agent Development Kit) and Gemini 3.5.
  - High-horizon market research and analysis agent with integrated Google Workspace CLI (`gws`) tools for Docs and Sheets automation.
  - Communicates strictly with the local gateway sidecar over HTTP via `gateway_client.py`.

- 🛡️ **`.nim/` (Reliability Harness & Agent Memory)**
  - Governed by `nim-skill` runtime harness enforcing WR-01 through WR-07 working rules.
  - Immutable test traces (`traces.jsonl`), failure lessons (`lessons.jsonl`), and token ROI tracking (`agent-support-log.md`).

- 📚 **`docs/` (Specifications & Live State)**
  - Active session checkpointing (`docs/state/active_session.md`) ensuring seamless handoffs across development tasks.
  - Feature briefs and architectural invariants (`docs/features/`).

---

## 🤖 Agent Fleet Management & Observability

OpenX Portal provides comprehensive fleet monitoring, turning disparate background scripts into structured, observable agents:

- 📋 **Multi-Host Agent Registry (`gateway/src/services/agentRegistry.ts`)**
  - Supports multiple host environments: `kiro-cli`, `claude-code`, `adk-python`, and `custom`.
  - Flexible registration: Explicit API enrollment or seamless auto-discovery when agents first report telemetry.
  - Cryptographic credential verification using scrypt-hashed bearer tokens for zero-trust agent authentication.

- 💓 **Real-Time Health & Presence Telemetry**
  - Configurable online heartbeat window (defaults to 90 seconds).
  - Status state machine: `registered` ➔ `online` ➔ `offline` ➔ `auto_discovered` ➔ `revoked`.
  - Live task phase monitoring tracking active jobs, completion statuses, errors, and tool traces.

- 📈 **5-Stage Training Progression**
  - Stage 0: `Onboarded` — Initial registration and environment handshake.
  - Stage 1: `SkillsAdded` — Core tools, MCP capabilities, and prompt templates linked.
  - Stage 2: `Evaluated` — Benchmark testing and audit verification completed.
  - Stage 3: `Orchestrator` — Multi-tool autonomous task execution activated.
  - Stage 4: `Dreamed` — Active cognitive REM cycle linked with persistent memory consolidation.

---

## 💳 Credit Consumption Tracking & Usage Ledger

The Usage Ledger (`gateway/src/services/usageLedger.ts`) implements enterprise-grade token metering and cost accounting:

- 🪙 **Granular Gemini Model Token Metering**
  - Tracks 4 distinct token types: Standard Input Tokens, Output Tokens, Context-Cached Input Tokens, and Reasoning/Thinking Tokens.
  - Transparent micro-USDC rate catalog (`gemini-3.5-flash` rates: $1.50/M input, $9.00/M output, $0.15/M cached input, $9.00/M reasoning).
  - Measures token savings and avoided costs generated by context optimization and prompt caching.

- 🔧 **Per-Tool Cost Billing**
  - Meters billable tool calls (e.g., Google Search at 14,000 micro-USDC per query) alongside zero-fee local tools.
  - Aggregates operational usage events across agents with month-by-month billing partition keys.

- 📊 **Tiered Subscription Plans & Operating Controls**
  - **Starter Plan**: Zero base fee, 5 USDC included allowance, 25% overage multiplier, 15% platform fee.
  - **Pro Plan**: 29 USDC monthly fee, 40 USDC included allowance, 20% overage multiplier, 15% platform fee.
  - **Enterprise Plan**: Custom volume licensing, 10% overage multiplier, 10% platform fee.
  - Operating rules configurable in Portal UI: buyer daily spending caps, free trial invocation allowances, and revenue share parameters.

- 📉 **Visual Consumption Analytics (`TokenConsumptionCard.tsx`)**
  - High-visibility progress gauges indicating consumed vs. remaining monthly allowances.
  - Detailed cost breakdowns: provider base cost, gross billed amount, platform fee, and net operator earnings.

---

## 🛠️ Skills & Tool-Calling Registry

The Skills subsystem (`portal/src/components/skills/` & `gateway/src/services/agentIngestionStore.ts`) provides full governance over tool capabilities:

- 📦 **Skill Catalog & Lifecycle States**
  - `active`: Fully validated, benchmarked, and authorized for live agent task orchestration.
  - `in_audit`: Undergoing automated security review or awaiting operator confirmation.
  - `deprecated`: Flagged for retirement with migration warnings.

- 📊 **Real-Time Skill Telemetry**
  - Invocations counter: Total calls, successful executions, and failures.
  - Latency profiling: Moving average latency in milliseconds per skill.
  - Recency tracking: Exact ISO timestamp of the most recent invocation.

- 🔍 **Trigger Patterns & Inspection**
  - Regex and keyword trigger patterns determining when the agent invokes specific tools.
  - Code inspection viewer displaying skill templates, input schemas, and execution sandboxes.
  - Multi-origin provenance: Distinguishes between local custom code, marketplace forks, and Dream Cycle synthesized skills.

---

## 🧠 Dream Cycle & REM Memory Consolidation

Inspired by mammalian sleep consolidation, the Dream Cycle subsystem (`gateway/src/services/dreamGateway.ts`) allows agents to synthesize daily experiences into long-term intelligence:

- 🔄 **The 4-Stage REM Cognitive Cycle**
  - **1. Encode**: Ingests task trajectories, tool telemetry, and failure traces from recent waking sessions.
  - **2. Consolidate**: Replays execution episodes to detect recurring failure modes, dead ends, and high-efficiency paths.
  - **3. Integrate**: Derives concise, high-signal behavioral rules (Managed Lessons) and links them to semantic concept graphs.
  - **4. Prune & Synthesize**: Evaporates transient noise, compresses context memory buffers, and generates candidate tool functions.

- 📝 **Managed Lessons Lifecycle**
  - `UNREVIEWED`: Freshly synthesized lesson extracted from an episode run.
  - `IN_REVIEW`: Currently undergoing validation by the operator or Auditor Agent.
  - `PROMOTED_CONSTRAINT`: Formally activated behavioral guardrail injected into agent prompts.
  - `QUARANTINED` / `REJECTED`: Contradictory or unverified lessons pruned from active memory.

- ☀️ **Morning Wake Context & Briefings**
  - Generates a synthesized "Morning Brief" summarizing recent discoveries, resolved blockers, and key priorities.
  - Pre-warms active memory buffers and embedding indices for immediate wake execution.
  - Reduces redundant context window overhead by keeping waking prompts lean and focused.

- ✨ **Automated Skill Promotion ("Skillify")**
  - Synthesizes repeated operational workflows into standalone reusable skill packages.
  - Attaches empirical confidence scores, capability identifiers, and cryptographic artifact hashes.
  - One-click promotion enables human operators to review and deploy newly generated skills directly to the catalog.

- 🗄️ **Immutable 0G Decentralized Memory Vault**
  - Sanitizes private keys, bearer tokens, and PII before serialization.
  - Publishes validated lessons and memories to 0G Storage with cryptographic Merkle root hashes and transaction receipts.

---

## 🛡️ Autonomous Auditor Agent Architecture

The Auditor Agent (`gateway/src/services/auditorService.ts`) acts as an objective supervisor, validating that agent performance and lessons adhere to strict standards:

- 🔍 **Dual-Mode Verification Engine**
  - **Mode 1: 0G Compute LLM Structured Audit**: Submits candidate lessons, execution telemetry, and learning briefs to high-integrity LLMs. Enforces strict JSON Schema validation via Zod (`lesson_reviews` with verdict `keep`, `revise`, or `reject` + supporting evidence citations).
  - **Mode 2: Resilient Heuristic Fallback**: Generates deterministic, citation-backed audits from verified task history and telemetry when external compute is unreachable.

- ⏱️ **Real-Time Audit Event Pipeline**
  - Seven distinct lifecycle stages: `queued` ➔ `gathering_evidence` ➔ `requesting_review` ➔ `validating` ➔ `persisting` ➔ `completed` (with exponential backoff on retries).
  - Complete audit timeline visible directly inside the Portal UI (`portal/src/app/[agentId]/auditor/page.tsx`).

- 💬 **Interactive Citation-Grounded Auditor Chat**
  - Operators can query the Auditor Agent directly regarding agent performance, failure causes, or lesson rationale.
  - Every answer is strictly grounded in evidence citations (citing specific task IDs, telemetry metrics, lesson hashes, or Dream runs).
  - Built-in rate limiting and prompt-injection guardrails prevent audit drift.

---

## 🔌 HyperMove MCP Integration & XRPL Settlement

OpenX Portal integrates seamlessly with the Model Context Protocol (MCP) ecosystem to access external compute, tools, and cross-chain execution:

- 🌐 **HyperMove MCP Client (`HyperMoveClient`)**
  - Standardized JSON-RPC protocol over HTTP connecting to `HYPERMOVE_MCP_URL`.
  - Exposes essential capabilities: `get_dream_stats`, `get_dream_readiness`, `list_my_dream_agent_ids`, and `submit_episode_log`.

- 🔐 **AES-256-GCM Encrypted Credential Vault**
  - Bearer tokens encrypted using 256-bit AES in Galois/Counter Mode (GCM) with 96-bit random initialization vectors (IVs) and authentication tags.
  - Securely persisted inside SQLite; keys never leak into client responses or logs.

- 💸 **XRPL x402 RLUSD Micropayments (`gateway/src/services/xrplSettlement.ts`)**
  - Autonomous HTTP 402 Payment Required negotiation protocol.
  - Automatically fetches quotes, validates destination accounts, signs transactions, and submits payments using RLUSD stablecoin on the XRPL testnet.
  - Cryptographic transaction hashes recorded and reconciled against Dream run quotes to prevent double-spending.

- ⚡ **Frictionless Onboarding Models**
  - **Portal-Managed One-Click Setup**: Zero-configuration setup utilizing the gateway's shared service token (`HYPERMOVE_MCP_SERVICE_TOKEN`).
  - **Self-Sovereign Agent Keys**: Dedicated per-agent bearer tokens provisioned directly by the operator.

---

## 💾 Data Layer & Persistence Architecture

The Gateway persistence layer is engineered for zero-maintenance reliability, local-first operation, and high concurrency:

- 🗄️ **High-Performance SQLite with WAL Mode (`gateway/src/db/database.ts`)**
  - Powered by `better-sqlite3` native bindings for low-latency synchronous reads.
  - Configured with `PRAGMA journal_mode = WAL` (Write-Ahead Logging) for non-blocking concurrent reads during writes.
  - Tuned with `PRAGMA synchronous = NORMAL` and a 5000ms busy timeout to eliminate lock contention.

- 📐 **Versioned Database Schema**
  - `_migrations`: Tracks applied schema migrations and timestamps.
  - `gateway_state`: High-speed key-value store for application state, configurations, and aggregated indices.
  - `audit_runs` & `audit_findings`: Relational tables storing structured evaluation runs, verdicts, and evidence arrays.
  - `agent_knowledge_records`: Durable ledger tracking 0G Storage synchronization states, root hashes, and transaction proofs.

- 🔄 **Atomic In-Memory & File Synchronization**
  - Active runtime state (Dream runs, lessons, registered agents) managed in memory with atomic temporary-file writes (`fs.writeFileSync` + `fs.renameSync`) to eliminate corruption risks during unexpected terminations.

- ⚛️ **Reactive Frontend Hydration (`portalContext.tsx`)**
  - Single React context orchestrating global agent fleet state, active agent selections, credit models, skills, and dream telemetry.
  - Periodic polling and optimistic updates keep the UI synchronized with the gateway sidecar without requiring full page reloads.

---

## 🚀 Quickstart & Development Guide

### 📋 Prerequisites

- Node.js 18+ and npm 9+
- Python 3.11+ (with `venv` and `pip`)
- SQLite 3

### ⚡ Option 1: Unified Application Runner (Recommended)

The provided root script checks dependencies, compiles both TypeScript packages, and launches both services:

```bash
# Clone the repository
git clone https://github.com/phamdat721101/openx-portal.git
cd openx-portal

# Execute unified build and start script
./start.sh
```

- 🌐 **Portal UI**: Accessible at `http://localhost:3010`
- ⚡ **Gateway API**: Serving at `http://localhost:7411`
- 🩺 **Health Endpoint**: `http://localhost:7411/health`

### 🔧 Option 2: Component-by-Component Setup

#### 1. Start the Gateway Sidecar

```bash
cd gateway

# Copy sample environment configuration
cp .env.example .env

# Install dependencies
npm install

# Run tests
npm test

# Launch development server with hot-reload
npm run dev
```

#### 2. Start the Analyst Portal

```bash
cd portal

# Copy sample environment configuration
cp .env.example .env.local

# Install dependencies
npm install

# Typecheck and run development server
npm run dev
```

#### 3. Run the Python Agent

```bash
cd agent

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Run the agent orchestrator
python3 main.py
```

### ⚙️ Key Environment Configuration (`gateway/.env`)

- `PORT`: HTTP port for Gateway sidecar (Default: `7411`)
- `OPENX_DB_PATH`: Path to SQLite database file (Default: `.openx/openx-gateway.db`)
- `OPENX_DREAM_TOKEN_ENCRYPTION_KEY`: Base64-encoded 32-byte secret key for AES-256-GCM token encryption
- `HYPERMOVE_MCP_URL`: Endpoint of the HyperMove MCP server
- `HYPERMOVE_MCP_SERVICE_TOKEN`: Service bearer token for portal-managed Dream setup
- `XRPL_RPC_URL`: XRPL node JSON-RPC endpoint for x402 micropayment settlement
- `ZEROG_STORAGE_ENABLED`: Toggle 0G decentralized storage archival (`true` / `false`)
- `ZEROG_COMPUTE_API_URL`: Endpoint for 0G Compute LLM auditor evaluations

---

## 📄 License

MIT License. Copyright (c) 2026 OpenX Network.

