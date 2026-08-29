'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Terminal, Cpu, Database, ShieldCheck, Zap, Copy, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { MatrixChip } from '@/components/common/StatusBadge';

export default function DocsPage() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const curlStatus = `curl -s "http://localhost:7411/v1/agent/status?agentId=3fa85f64-5717-4562-b3fc-2c963f66afa6" | jq .`;

  const curlTelemetry = `curl -X POST "http://localhost:7411/v1/agent/telemetry" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "task_id": "task_defi_yield_scan",
    "model": "gemini-3.5",
    "tools_used": ["google-workspace-cli.sheets.read"],
    "latency_ms": 580,
    "status": "success"
  }'`;
  const usagePrompt = 'For every task, emit a usage event for each model request, tool/skill call, and nim-skill operation. Send token counts and billable units, never raw prompts or arguments. Report baseline and actual tokens only when measured.';

  const pythonSnippet = `from gateway_client import get_agent_status, submit_telemetry

# 1. Pre-flight self-introspection
status = get_agent_status("3fa85f64-5717-4562-b3fc-2c963f66afa6")
print(f"Agent Model: {status['model']['configured_model']}")

# 2. Submit execution trace after research step
submit_telemetry(
    agent_id="3fa85f64-5717-4562-b3fc-2c963f66afa6",
    task_id="task_yield_analysis",
    model="gemini-3.5",
    tools=["google-workspace-cli.sheets.read"],
    latency_ms=580,
    status="success"
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
          <MatrixChip label="Specification v1.0.0" />
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-headline text-sm font-bold text-on-surface">Usage Accounting Agent Instruction</h2><p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{usagePrompt}</p></div><button onClick={() => copyToClipboard(usagePrompt, 'usage-prompt')} className="shrink-0 text-xs text-primary">{copiedSection === 'usage-prompt' ? 'Copied' : 'Copy prompt'}</button></div>
      </div>

      {/* Grid Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-primary font-bold text-sm mb-2">
            <Cpu className="h-4 w-4" />
            <span>1. Introspection (Read)</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Single-call <code className="text-primary font-mono">GET /v1/agent/status</code> composing info, status, model, and cognitive memory. No balance or earnings data is returned.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-secondary font-bold text-sm mb-2">
            <Zap className="h-4 w-4" />
            <span>2. Submission (Write)</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Live ingestion via <code className="text-secondary font-mono">POST /v1/agent/telemetry</code> and <code className="text-secondary font-mono">/memory/episode</code>.
          </p>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
          <div className="flex items-center gap-2 text-agent-accent font-bold text-sm mb-2">
            <ShieldCheck className="h-4 w-4" />
            <span>3. Hybrid Live State</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Real agent submissions dynamically override portal screens, with rich sample baselines for unpopulated fields.
          </p>
        </div>
      </div>

      {/* Code Section 1: Read Path */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span>Agent Introspection API (`GET /v1/agent/status`)</span>
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
          Queries all 4 operational facets before initiating autonomous task loops. Supports field narrowing via <code className="font-mono text-primary">?fields=info,status,model,memory</code>.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlStatus}
        </pre>
      </div>

      {/* Code Section 2: Ingestion Path */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Zap className="h-4 w-4 text-secondary" />
            <span>Telemetry & Trace Ingestion API (`POST /v1/agent/telemetry`)</span>
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
          Submits execution telemetry, token consumption, tools used, and task latency. Immediately updates the Portal activity records.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {curlTelemetry}
        </pre>
      </div>

      {/* Code Section 3: Python SDK Example */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
            <Terminal className="h-4 w-4 text-agent-accent" />
            <span>Python ADK Agent Integration Example</span>
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
          Zero-dependency Python implementation utilizing standard library <code className="font-mono text-agent-accent">urllib</code>.
        </p>
        <pre className="rounded-xl bg-surface-container-lowest p-4 font-mono text-xs text-on-surface overflow-x-auto border border-outline-variant/20">
          {pythonSnippet}
        </pre>
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
