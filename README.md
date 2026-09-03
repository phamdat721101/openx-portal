# 🌐 OpenX Portal — AI Agent Management & Orchestration Platform

OpenX Portal is the unified mission control and execution harness for autonomous AI agents. Built as a high-performance monorepo, it pairs a **Next.js 14 Management Studio** (`:3010`) with a **Node/TypeScript Gateway Sidecar** (`:7411`) and a **Python Google ADK Orchestrator**.

---

## 🌟 Core Modules & Capabilities

- 🤖 **Agent Fleet Management**: Centralized registry for multi-host agents (`kiro-cli`, `claude-code`, `adk-python`, `custom`), real-time heartbeats, and 5-stage lifecycle tracking (`Onboarded` ➔ `Dreamed`).
- 💳 **Credit & Usage Ledger**: Micro-precision token accounting (Gemini input, output, cached prompt, reasoning), billable tool-call pricing, and spending caps.
- 🛠️ **Skills & Tools Inventory**: Tool governance lifecycle (`active`, `in_audit`, `deprecated`), trigger patterns, and runtime execution telemetry.
- 💾 **Data Layer & Persistence**: Embedded SQLite with WAL mode (`better-sqlite3`), versioned migrations, atomic file serialization, and reactive React hydration.
- 🛡️ **Autonomous Auditor Agent**: Evidence-based evaluation (0G Compute LLM + heuristic fallback), real-time SSE stream, and citation-grounded operator chat.
- 💸 **x402 & HyperMove MCP**: Remote MCP tool bridge, AES-256-GCM encrypted vault, XRPL RLUSD micropayment settlement, and REM Dream Cycle memory archival on 0G Storage.

---

## 🚀 Local Quickstart

### 📋 Prerequisites
- Node.js 18+ & npm 9+
- Python 3.11+ (`venv` & `pip`)
- SQLite 3

### ⚡ 1-Command Startup (Recommended)
Builds and serves both the Gateway and Portal in production mode:
```bash
git clone https://github.com/phamdat721101/openx-portal.git
cd openx-portal
./start.sh
```
- 🌐 **Portal Studio**: `http://localhost:3010`
- ⚡ **Gateway API**: `http://localhost:7411`
- 🩺 **Health Check**: `http://localhost:7411/health`

### 🔧 Manual Component Setup

#### 1. Gateway Sidecar (:7411)
```bash
cd gateway
cp .env.example .env
npm install
npm test
npm run dev
```

#### 2. Analyst Portal (:3010)
```bash
cd portal
cp .env.example .env.local
npm install
npm run dev
```

#### 3. Python ADK Agent
```bash
cd agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

---

## 📄 License

MIT License. Copyright (c) 2026 OpenX Network.

