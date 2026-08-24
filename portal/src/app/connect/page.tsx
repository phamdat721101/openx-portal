'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePortal } from '@/lib/portalContext';
import {
  Radio,
  Key,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Zap,
  Cpu,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { MatrixChip } from '@/components/common/StatusBadge';

export default function ConnectPage() {
  const { gatewayOnline, telemetryEvents, sendTestTelemetry, registerAgent, agents, showToast } = usePortal();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '3fa85f64-5717-4562-b3fc-2c963f66afa6');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);

  const [isRegistering, setIsRegistering] = useState(false);
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('OpenX Research Agent');
  const [hostType, setHostType] = useState<'kiro-cli' | 'claude-code' | 'adk-python' | 'custom'>('adk-python');
  const [model, setModel] = useState('gemini-3.5');

  const handleCopyKey = () => {
    if (!agentKey) return;
    navigator.clipboard.writeText(agentKey);
    setCopiedKey(true);
    showToast('API Key copied to clipboard', 'info');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleRegister = async () => {
    if (!displayName.trim()) {
      showToast('A display name is required', 'error');
      return;
    }
    setIsRegistering(true);
    const result = await registerAgent({ display_name: displayName.trim(), host_type: hostType, model: model.trim() || undefined, capabilities: ['telemetry'] });
    setIsRegistering(false);
    if (result.ok && result.agentId) {
      setSelectedAgentId(result.agentId);
      setAgentKey(result.agentKey || null);
    }
  };

  const handleTriggerTest = async () => {
    setIsSending(true);
    await sendTestTelemetry(selectedAgentId);
    setIsSending(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* Top Banner & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-6 w-6 text-primary animate-pulse" />
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
              Agent Connection & Ingestion Console
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant">
            Connect autonomous AI agents, issue credentials, monitor live heartbeats, and inspect incoming telemetry streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {gatewayOnline ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-xs font-mono font-bold text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              Gateway Sidecar Online (:7411)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-3 py-1 text-xs font-mono font-bold text-error">
              <AlertCircle className="h-3.5 w-3.5" />
              Gateway Offline (:7411)
            </span>
          )}
          <Link
            href="/docs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>API Docs</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid: Credentials & Live Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Credentials & Quick Config */}
        <div className="lg:col-span-1 space-y-6">
          {/* Agent Picker & Key Card */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <Key className="h-4 w-4 text-primary" />
              <span>Register Connected Agent</span>
            </div>

            <div>
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">Display name</label>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">Host
                <select value={hostType} onChange={(event) => setHostType(event.target.value as typeof hostType)} className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-high px-2 py-2 text-xs text-on-surface">
                  <option value="adk-python">ADK Python</option><option value="kiro-cli">Kiro CLI</option><option value="claude-code">Claude Code</option><option value="custom">Custom</option>
                </select>
              </label>
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">Model
                <input value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-high px-2 py-2 text-xs text-on-surface" />
              </label>
            </div>
            <button onClick={handleRegister} disabled={!gatewayOnline || isRegistering} className="w-full rounded-xl border border-primary/50 bg-primary/10 px-4 py-2 text-xs font-bold text-primary disabled:opacity-50">
              {isRegistering ? 'Registering…' : 'Register agent and issue key'}
            </button>

            <div>
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">Target Agent</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-high px-3 py-2 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name} ({a.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">Agent UUID</label>
              <div className="mt-1 rounded-xl bg-surface-container-highest/60 p-2.5 font-mono text-xs text-on-surface select-all truncate border border-outline-variant/20">
                {selectedAgentId}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-on-surface-variant uppercase">One-time gateway key</label>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-surface-container-highest/60 p-2.5 border border-outline-variant/20">
                <span className="font-mono text-xs text-on-surface truncate">{agentKey || 'A key is shown only immediately after registration.'}</span>
                <button
                  onClick={handleCopyKey}
                  disabled={!agentKey}
                  className="shrink-0 p-1 rounded-lg text-on-surface-variant hover:text-primary transition"
                  title="Copy Key"
                >
                  {copiedKey ? <Check className="h-4 w-4 text-secondary" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/20">
              <button
                onClick={handleTriggerTest}
                disabled={isSending || !gatewayOnline}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-headline text-xs font-bold text-on-primary shadow-sm hover:bg-[#33f3ff] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSending ? 'Transmitting Trace...' : 'Publish Test Telemetry'}</span>
              </button>
              {!gatewayOnline && (
                <p className="text-[11px] text-error mt-2 text-center">
                  Start Gateway via <code className="font-mono font-bold">./start.sh</code> to transmit live traces.
                </p>
              )}
            </div>
          </div>

          {/* Quick-start Env Guide */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <Terminal className="h-4 w-4 text-secondary" />
              <span>Agent Environment Config</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Set these variables in your agent&apos;s <code className="font-mono text-primary">.env</code> file:
            </p>
            <pre className="rounded-xl bg-surface-container-lowest p-3 font-mono text-[11px] text-on-surface overflow-x-auto border border-outline-variant/20">
{`OPENX_GATEWAY_URL=http://localhost:7411
OPENX_AGENT_ID=${selectedAgentId}
OPENX_AGENT_KEY=<store the one-time key in your host secret manager>
OPENX_MODEL=gemini-3.5`}
            </pre>
          </div>
        </div>

        {/* Right Column: Live Ingestion Stream */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="font-headline text-base font-bold text-on-surface">
                  Live Telemetry & Trace Stream
                </h2>
              </div>
              <span className="font-mono text-xs text-on-surface-variant">
                {telemetryEvents.length} Recent Events
              </span>
            </div>

            {telemetryEvents.length === 0 ? (
              <div className="py-12 text-center space-y-3 border border-dashed border-outline-variant/40 rounded-xl">
                <Zap className="h-8 w-8 text-on-surface-variant/40 mx-auto" />
                <p className="text-xs text-on-surface-variant">No live traces received yet in this session.</p>
                <p className="text-[11px] text-on-surface-variant/70 max-w-sm mx-auto">
                  Run <code className="font-mono text-primary">python3 agent/main.py</code> or click &ldquo;Publish Test Telemetry&rdquo; above to stream execution traces.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {telemetryEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-high/60 space-y-2 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="font-bold text-primary">{evt.task_id}</span>
                      <span className="text-on-surface-variant text-[11px]">
                        {new Date(evt.received_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant">
                      {evt.summary || 'Executed agent task workflow'}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/20">
                      <span>Model: <strong className="text-on-surface">{evt.model}</strong></span>
                      <span>Tokens: <strong className="text-secondary">{evt.tokens_consumed}</strong></span>
                      <span>Latency: <strong className="text-on-surface">{evt.latency_ms}ms</strong></span>
                      {evt.tools_used && evt.tools_used.length > 0 && (
                        <span>Tools: <strong className="text-agent-accent">{evt.tools_used.join(', ')}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
