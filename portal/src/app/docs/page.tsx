'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Terminal,
  Cpu,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Layers,
  CreditCard,
  ListChecks,
} from 'lucide-react';
import { MatrixChip } from '@/components/common/StatusBadge';
import { buildAgentConnectionPrompt, getAgentConnectionEnvironment } from '@/lib/agentConnectionPrompt';

export default function DocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const connectionEnvironment = getAgentConnectionEnvironment();
  const connectionPrompt = buildAgentConnectionPrompt();

  const curlRegister = `curl -X POST "${connectionEnvironment.gatewayUrl}/v1/agent/register" \\
  -H "Content-Type: application/json" \\
  -d '{
    "display_name": "XRPL Research Analyst",
    "slug": "xrpl-research-analyst",
    "description": "Autonomous XRPL ledger intelligence, RLUSD liquidity monitoring, and x402 settlement agent",
    "model": "gemini-3.8-flash",
    "capabilities": ["xrpl-rpc", "market-depth", "settlement-proof"],
    "host_type": "adk-python",
    "wallet_address": "rPT1Sjq2YGrBMTttX4GZHjKu9DYfzbpAYe"
  }'`;

  const curlSync = `curl -X POST "${connectionEnvironment.gatewayUrl}/v1/agent/sync" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: <OPENX_AGENT_KEY>" \\
  -d '{
    "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "model": "gemini-3.8-flash",
    "tools": ["xrpl-rpc-client", "gateway_balances-query", "amm_info-query"],
    "skills": ["rlusd-onchain-auditor", "xls-30-amm-analyzer"],
    "plan_id": "pro"
  }'`;

  const curlStatus = `curl -s "${connectionEnvironment.gatewayUrl}/v1/agent/status?agentId=3fa85f64-5717-4562-b3fc-2c963f66afa6" | jq .`;

  const curlTelemetry = `curl -X POST "${connectionEnvironment.gatewayUrl}/v1/agent/telemetry" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: <OPENX_AGENT_KEY>" \\
  -d '{
    "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "task_id": "task_xrpl_settlement_audit",
    "model": "gemini-3.8-flash",
    "tokens_consumed": 2450,
    "tools_used": ["xrpl-rpc-client"],
    "latency_ms": 1420,
    "status": "success",
    "task_state": "completed",
    "task_title": "Audit XRPL Ledger Settlement Traces",
    "task_category": "analysis",
    "current_phase": "delivery",
    "progress_pct": 100,
    "summary": "Verified 5 on-chain RLUSD payments and reconciled x402 quotes against facilitator nodes."
  }'`;

  const curlWorkingLog = `curl -X POST "${connectionEnvironment.gatewayUrl}/v1/agents/3fa85f64-5717-4562-b3fc-2c963f66afa6/tasks/task_xrpl_settlement_audit/working-log" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: <OPENX_AGENT_KEY>" \\
  -d '{
    "event_id": "evt_wl_001",
    "sequence": 1,
    "phase": "analysis",
    "kind": "phase",
    "progress_pct": 50,
    "markdown": "Extracted transaction hashes and validated XRPL ledger consensus index."
  }'`;

  const curlSettlement = `curl -X POST "${connectionEnvironment.gatewayUrl}/v1/agents/3fa85f64-5717-4562-b3fc-2c963f66afa6/settlements" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: <OPENX_AGENT_KEY>" \\
  -d '{
    "transaction_hash": "4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F",
    "quote_id": "quote_x402_rlusd_001",
    "amount": "0.05",
    "currency": "RLUSD",
    "merchant_address": "rPT1Sjq2YGrBMTttX4GZHjKu9DYfzbpAYe",
    "facilitator_node": "hypermove-gateway-relay",
    "network": "xrpl-testnet",
    "status": "validated"
  }'`;

  const pythonSnippet = `from gateway_client import (
    register_agent,
    sync_agent_capabilities,
    get_agent_status,
    submit_telemetry,
    submit_working_log,
    sync_settlement,
)

# 1. Register agent & receive one-time agent key
# Supports EVM (0x...) or XRPL classic (r...) wallet addresses
reg = register_agent(
    display_name="XRPL Research Analyst",
    model="gemini-3.8-flash",
    capabilities=["xrpl-rpc", "market-depth", "settlement-proof"],
    host_type="adk-python",
    wallet_address="rPT1Sjq2YGrBMTttX4GZHjKu9DYfzbpAYe",
)
agent_id = reg["agent"]["agent_id"]
agent_key = reg["credential"]["agent_key"]

# 2. Sync capabilities (flips state to online in Studio Hub)
sync_agent_capabilities(
    agent_id=agent_id,
    agent_key=agent_key,
    model="gemini-3.8-flash",
    tools=["xrpl-rpc-client", "gateway_balances-query"],
    skills=["rlusd-onchain-auditor"],
    plan_id="pro",
)

# 3. Submit telemetry and multi-step working log timeline
submit_telemetry(
    agent_id=agent_id,
    agent_key=agent_key,
    task_id="task_xrpl_settlement_audit",
    model="gemini-3.8-flash",
    tokens_consumed=2450,
    tools=["xrpl-rpc-client"],
    latency_ms=1420,
    status="success",
    task_title="Audit XRPL Ledger Settlement Traces",
    summary="Validated on-chain payments against facilitator nodes.",
)

# 4. Sync on-chain settlement transaction to Dream Cycle ledger
sync_settlement(
    agent_id=agent_id,
    agent_key=agent_key,
    transaction_hash="4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F",
    quote_id="quote_x402_rlusd_001",
    amount="0.05",
    merchant_address="rPT1Sjq2YGrBMTttX4GZHjKu9DYfzbpAYe",
    facilitator_node="hypermove-gateway-relay",
    currency="RLUSD",
    network="xrpl-testnet",
    status="validated",
)`;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
              Developer Documentation & Integration Guide
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant">
            Technical specifications for connecting autonomous AI agents to the OpenX Gateway Sidecar (:7411) and Agent Portal (:3010).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/llms.txt"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-mono font-bold text-primary hover:bg-primary/20 transition"
          >
            <span>Raw llms.txt</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <MatrixChip label="Specification v1.1.0" />
        </div>
      </div>

      {/* Copy-Paste Prompt Hero */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-headline text-sm font-bold text-on-surface">
              Agent connection & data-sync prompt
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
              Copy this reusable, secret-free instruction after registration. It instructs the agent to declare capabilities, publish its first safe task timeline, sync on-chain settlement proofs, and verify the sync against <strong>{connectionEnvironment.label}</strong> at <code>{connectionEnvironment.gatewayUrl}</code>.
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(connectionPrompt, 'connection-prompt')}
            className="shrink-0 text-xs font-bold text-primary hover:text-primary-variant transition"
          >
            {copiedSection === 'connection-prompt' ? 'Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-container-lowest p-4 font-mono text-[11px] text-on-surface border border-outline-variant/20">
          {connectionPrompt}
        </pre>
      </div>

      {/* Grid Overview Cards (4 Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
            <KeyRound className="h-4 w-4" />
            <span>1. Registration</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Register via <code className="text-primary font-mono">POST /v1/agent/register</code> with EVM (<code className="font-mono">0x...</code>) or XRPL classic (<code className="font-mono">r...</code>) wallet address. Issues one-time <code className="font-mono">agent_key</code>.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm mb-2">
            <RefreshCw className="h-4 w-4" />
            <span>2. Capability Sync</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Synchronize active tools, skills, and model via <code className="text-secondary font-mono">POST /v1/agent/sync</code>. Flips agent state from offline to online.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-agent-accent font-bold text-sm mb-2">
            <Layers className="h-4 w-4" />
            <span>3. Working Logs</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Send lifecycle traces (<code className="text-agent-accent font-mono">/telemetry</code>) and multi-step phase working logs (<code className="text-agent-accent font-mono">/working-log</code>) for split-screen task review.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
            <CreditCard className="h-4 w-4" />
            <span>4. Settlement Sync</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Sync validated x402 on-chain transactions via <code className="text-primary font-mono">POST /v1/agents/:id/settlements</code> with tx-hash, facilitator node, and merchant address.
          </p>
        </div>
      </div>

      {/* Code Section 1: Registration API */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span>1. Agent Registration API (`POST /v1/agent/register`)</span>
          </h2>
          <button
            onClick={() => copyToClipboard(curlRegister, 'register')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition"
          >
            {copiedSection === 'register' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'register' ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Public self-service agent onboarding. Returns the stable <code className="font-mono text-primary">agent_id</code> and a one-time <code className="font-mono text-primary">agent_key</code>. Save this credential in the host environment or secret manager. Supports optional EVM (<code className="font-mono">0x...</code>) or XRPL (<code className="font-mono">r...</code>) wallet addresses.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlRegister}
        </pre>
      </div>

      {/* Code Section 2: Capability Sync API */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-secondary" />
            <span>2. Capability Synchronization API (`POST /v1/agent/sync`)</span>
          </h2>
          <button
            onClick={() => copyToClipboard(curlSync, 'sync')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-secondary transition"
          >
            {copiedSection === 'sync' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'sync' ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Call at startup and on a 5-minute schedule. Flips the agent from <code className="font-mono">offline</code> to <code className="font-mono text-secondary">online</code> in Studio Hub and updates declared tools, skills, and subscription tier.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlSync}
        </pre>
      </div>

      {/* Code Section 3: Introspection Path */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span>3. Agent Introspection API (`GET /v1/agent/status`)</span>
          </h2>
          <button
            onClick={() => copyToClipboard(curlStatus, 'status')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition"
          >
            {copiedSection === 'status' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'status' ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Queries all 4 operational facets (identity, status, model configuration, and cognitive memory) before initiating autonomous task loops. Supports field narrowing via <code className="font-mono text-primary">?fields=info,status,model,memory</code>.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlStatus}
        </pre>
      </div>

      {/* Code Section 4: Telemetry & Working Logs */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Zap className="h-4 w-4 text-secondary" />
            <span>4. Telemetry & Multi-Step Working Logs (`POST /v1/agent/telemetry`)</span>
          </h2>
          <button
            onClick={() => copyToClipboard(curlTelemetry, 'telemetry')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-secondary transition"
          >
            {copiedSection === 'telemetry' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'telemetry' ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Submits execution telemetry, token consumption, tools used, and task latency. Populates the task list and activity stream.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlTelemetry}
        </pre>

        <div className="pt-3 border-t border-outline-variant/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-on-surface">Multi-Step Working Log Timeline (`POST /v1/agents/:id/tasks/:taskId/working-log`)</span>
            <button
              onClick={() => copyToClipboard(curlWorkingLog, 'working-log')}
              className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-secondary transition"
            >
              {copiedSection === 'working-log' ? <Check className="h-3 w-3 text-secondary" /> : <Copy className="h-3 w-3" />}
              <span>{copiedSection === 'working-log' ? 'Copied' : 'Copy Working Log cURL'}</span>
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed mb-2">
            Streams chronological execution steps (<code className="font-mono">planning &rarr; research &rarr; analysis &rarr; verification &rarr; delivery</code>) into the portal&apos;s split-screen viewer.
          </p>
          <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
            {curlWorkingLog}
          </pre>
        </div>
      </div>

      {/* Code Section 5: On-Chain Settlement Sync */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <span>5. On-Chain Settlement Sync API (`POST /v1/agents/:agentId/settlements`)</span>
          </h2>
          <button
            onClick={() => copyToClipboard(curlSettlement, 'settlement')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition"
          >
            {copiedSection === 'settlement' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'settlement' ? 'Copied' : 'Copy cURL'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          When an agent executes an on-chain transaction or settles an x402 payment quote on XRPL Testnet, sync the verified receipt into OpenX. The transaction is deduplicated and rendered in the <strong>Dream Cycle &gt; On-Chain Settlement Ledger</strong> with direct links to the XRPL Testnet Explorer.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlSettlement}
        </pre>
      </div>

      {/* Code Section 6: Python ADK Example */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Terminal className="h-4 w-4 text-agent-accent" />
            <span>6. Python ADK Agent Integration Example</span>
          </h2>
          <button
            onClick={() => copyToClipboard(pythonSnippet, 'python')}
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-agent-accent transition"
          >
            {copiedSection === 'python' ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedSection === 'python' ? 'Copied' : 'Copy Python'}</span>
          </button>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Zero-dependency Python implementation utilizing standard library <code className="font-mono text-agent-accent">urllib</code>. Integrates registration, capability sync, telemetry, and on-chain settlement sync.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {pythonSnippet}
        </pre>
      </div>

      {/* Verification Checklist Table */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <span>7. End-to-End Read Verification Checklist</span>
        </h2>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Before marking integration complete, run these 6 read-only verification endpoints to ensure all data layers are operational:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-on-surface">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant font-mono text-[11px]">
                <th className="pb-2">Check</th>
                <th className="pb-2">Endpoint</th>
                <th className="pb-2">Target Data Layer</th>
                <th className="pb-2">Expected Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 font-mono text-[11px]">
              <tr>
                <td className="py-2 text-primary font-bold">1</td>
                <td className="py-2">GET /health</td>
                <td className="py-2 text-on-surface-variant">Gateway Process &amp; SQLite WAL</td>
                <td className="py-2 text-secondary">200 OK (ok: true)</td>
              </tr>
              <tr>
                <td className="py-2 text-primary font-bold">2</td>
                <td className="py-2">GET /v1/agents/:id</td>
                <td className="py-2 text-on-surface-variant">Agent Registry Record</td>
                <td className="py-2 text-secondary">200 OK (state: online)</td>
              </tr>
              <tr>
                <td className="py-2 text-primary font-bold">3</td>
                <td className="py-2">GET /v1/agents/:id/activity</td>
                <td className="py-2 text-on-surface-variant">Activity Feed &amp; Tasks</td>
                <td className="py-2 text-secondary">200 OK (recent tasks array)</td>
              </tr>
              <tr>
                <td className="py-2 text-primary font-bold">4</td>
                <td className="py-2">GET /v1/agents/:id/tasks</td>
                <td className="py-2 text-on-surface-variant">Task Deliverables &amp; Working Logs</td>
                <td className="py-2 text-secondary">200 OK (stepper events)</td>
              </tr>
              <tr>
                <td className="py-2 text-primary font-bold">5</td>
                <td className="py-2">GET /v1/agents/:id/usage-detail</td>
                <td className="py-2 text-on-surface-variant">Credit Economics &amp; nim Savings</td>
                <td className="py-2 text-secondary">200 OK (token breakdown)</td>
              </tr>
              <tr>
                <td className="py-2 text-primary font-bold">6</td>
                <td className="py-2">GET /v1/settlement/history?agent_id=:id</td>
                <td className="py-2 text-on-surface-variant">Dream Cycle Settlement Ledger</td>
                <td className="py-2 text-secondary">200 OK (on-chain receipts)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl border border-primary/30 bg-primary/5">
        <div>
          <h3 className="font-headline text-sm font-bold text-on-surface">Ready to onboard a new agent?</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">Studio Hub is the single workspace for connected-agent activity and task status.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-headline text-xs font-bold text-on-primary shadow-sm hover:bg-[#33f3ff] transition"
        >
          <span>Open Studio Hub</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
