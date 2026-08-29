'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePortal } from '@/lib/portalContext';
import { usePortalAuth } from './PortalAuthProvider';
import { TrainingStagePill, MatrixChip } from '@/components/common/StatusBadge';
import { Bot, ArrowRight, Moon, Radio, AlertCircle, Plus, X, Copy, Activity } from 'lucide-react';

export default function AgentStudioPage() {
  const { agents, agentActivity, usageSummaries, registerAgent, gatewayOnline } = usePortal();
  const { enabled: authEnabled, ready: authReady, authenticated, login, walletAddress } = usePortalAuth();
  const [showConnect, setShowConnect] = useState(false);
  const [displayName, setDisplayName] = useState('OpenX Research Agent');
  const [hostType, setHostType] = useState<'kiro-cli' | 'claude-code' | 'adk-python' | 'custom'>('adk-python');
  const [model, setModel] = useState('gemini-3.5');
  const [registration, setRegistration] = useState<{ agentId: string; agentKey?: string } | null>(null);
  const [registering, setRegistering] = useState(false);
  const fleet = useMemo(() => Object.values(agentActivity), [agentActivity]);
  const running = fleet.filter((item) => item.activity.current_task).length;
  const online = fleet.filter((item) => item.state === 'online').length;

  const connectAgent = async () => {
    if (!authEnabled || !authenticated || !walletAddress) return;
    setRegistering(true);
    const result = await registerAgent({ display_name: displayName, host_type: hostType, model, capabilities: ['telemetry', 'usage-events', 'task-lifecycle'], owner_address: walletAddress || undefined, wallet_address: walletAddress || undefined });
    setRegistering(false);
    if (result.ok && result.agentId) setRegistration({ agentId: result.agentId, agentKey: result.agentKey });
  };

  if (authEnabled && (!authReady || !authenticated)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-agent-accent/15 text-agent-accent border border-agent-accent/30 shadow-[0_0_30px_rgba(124,92,255,0.25)]">
          <Bot className="h-8 w-8" />
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface">OpenX Agent Portal</h1>
        <p className="max-w-md text-sm text-on-surface-variant mt-2 mb-6 leading-relaxed">
          Connect your creator wallet to manage autonomous research agents, attach skills, configure operating rules, and inspect Dream Cycle telemetry.
        </p>
        <button disabled={!authReady}
          onClick={login}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:bg-[#33f3ff] transition"
        >
          {authEnabled ? 'Sign In with Wallet' : 'Wallet Login Unavailable'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
            Agent Studio Hub
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Operator management console for your active OpenX autonomous agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MatrixChip label="Cryptographically Verified" />
          <button onClick={() => { setRegistration(null); setShowConnect(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary"><Plus className="h-3.5 w-3.5" />Connect Agent</button>
        </div>
      </div>

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="font-headline text-base font-bold text-on-surface">Fleet Activity</h2></div><p className="mt-1 text-xs text-on-surface-variant">Live task state from agent-owned heartbeats.</p></div><div className="flex gap-2 text-[11px] font-mono"><span className="rounded bg-primary/10 px-2 py-1 text-primary">{running} running</span><span className="rounded bg-secondary/10 px-2 py-1 text-secondary">{online} online</span><span className="rounded bg-surface-container-high px-2 py-1 text-on-surface-variant">{gatewayOnline ? 'gateway connected' : 'gateway unavailable'}</span></div></div>
        {fleet.length > 0 ? <div className="mt-4 divide-y divide-outline-variant/20">{fleet.slice(0, 5).map((item) => { const agent = agents.find((entry) => entry.id === item.agent_id); const task = item.activity.current_task || item.activity.latest_task; return <div key={item.agent_id} className="flex items-center justify-between gap-3 py-3 text-xs"><div className="min-w-0"><p className="truncate font-semibold text-on-surface">{agent?.display_name || item.agent_id}</p><p className="truncate text-on-surface-variant">{task?.title || (item.state === 'online' ? 'Idle — waiting for a task' : 'No heartbeat received')}</p></div><div className="shrink-0 text-right font-mono"><p className={task?.state === 'running' ? 'text-primary' : item.state === 'online' ? 'text-secondary' : 'text-on-surface-variant'}>{task?.state || item.state}</p><p className="text-[10px] text-on-surface-variant">{task?.phase || '—'}</p></div></div>; })}</div> : <div className="mt-4 rounded-xl border border-dashed border-outline-variant/40 p-5 text-center"><p className="text-sm font-semibold text-on-surface">No agent heartbeat received</p><p className="mt-1 text-xs text-on-surface-variant">Connect an agent here, then run its sync scheduler or task worker to report live activity.</p><button onClick={() => setShowConnect(true)} className="mt-3 text-xs font-bold text-primary">Connect an agent</button></div>}
      </section>

      {/* Agents Grid Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>Your Managed Agents ({agents.length})</span>
          </h2>
          <span className="text-xs text-on-surface-variant font-mono">
            Select an agent to manage skills, operating rules, and Dream Cycle telemetry
          </span>
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const hasDreamLinked = !!agent.hypermove_dream_agent_id;
            const activity = agentActivity[agent.id];
            const task = activity?.activity.current_task || activity?.activity.latest_task;
            const usage = usageSummaries.find((summary) => summary.agent_id === agent.id);

            return (
              <Link
                key={agent.id}
                href={`/${agent.id}/skills`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(0,240,255,0.12)] agent-card-border"
              >
                <div>
                  {/* Top Bar: Stage & Dream Tag */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <TrainingStagePill stage={agent.training_stage} />
                    {hasDreamLinked ? (
                      <span className="inline-flex items-center gap-1 rounded bg-secondary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-secondary border border-secondary/30">
                        <Moon className="h-2.5 w-2.5" /> REM Active
                      </span>
                    ) : (
                      <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
                        Unlinked
                      </span>
                    )}
                  </div>

                  {/* Agent Display Name */}
                  <h3 className="font-headline text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                    {agent.display_name}
                  </h3>
                  <div className="mt-4 rounded-xl border border-outline-variant/20 bg-surface-container-high/50 p-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wide">
                      <span className={activity?.state === 'online' ? 'text-secondary' : 'text-on-surface-variant'}>
                        {activity?.state === 'online' ? <Radio className="mr-1 inline h-3 w-3 animate-pulse" /> : <AlertCircle className="mr-1 inline h-3 w-3" />}
                        {activity?.state || 'not connected'}
                      </span>
                      {task && <span className={task.state === 'running' ? 'text-primary' : task.state === 'failed' ? 'text-error' : 'text-secondary'}>{task.state}</span>}
                    </div>
                    {task ? <div className="mt-2"><p className="truncate text-xs font-semibold text-on-surface">{task.title || task.task_id}</p><p className="mt-1 truncate text-[11px] text-on-surface-variant">{task.phase || 'Awaiting next phase'} · {task.model}</p>{task.tools_used.length > 0 && <p className="mt-1 truncate text-[10px] text-agent-accent">{task.tools_used.join(', ')}</p>}</div> : <p className="mt-2 text-[11px] text-on-surface-variant">No task activity received yet.</p>}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-3 line-clamp-2 leading-relaxed">{agent.description}</p>
                  {usage && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-on-surface-variant"><span className="text-primary">{usage.plan_id}</span><span>{(usage.input_tokens + usage.output_tokens).toLocaleString()} tokens</span><span>{usage.tool_calls} tools</span><span>{usage.skill_calls} skills</span></div>}
                </div>

                {/* Action Footer */}
                <div className="mt-5 pt-4 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>Manage Agent</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      {showConnect && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="font-headline text-lg font-bold text-on-surface">Connect Agent</h2><p className="mt-1 text-xs text-on-surface-variant">Issue a one-time agent key from Studio Hub.</p></div><button onClick={() => setShowConnect(false)}><X className="h-5 w-5 text-on-surface-variant" /></button></div>{registration ? <div className="mt-5 space-y-3"><p className="text-xs text-secondary">Agent registered. Save this key now; it is shown once.</p><code className="block break-all rounded-xl bg-surface-container-high p-3 text-xs text-on-surface">OPENX_AGENT_ID={registration.agentId}{'\n'}OPENX_AGENT_KEY={registration.agentKey || 'not returned'}</code><button onClick={() => registration.agentKey && navigator.clipboard.writeText(registration.agentKey)} className="inline-flex items-center gap-1 text-xs font-bold text-primary"><Copy className="h-3.5 w-3.5" />Copy key</button><p className="text-[11px] text-on-surface-variant">Schedule <code>python3 agent/sync_agent.py</code> every five minutes and run the agent worker for live task heartbeats.</p></div> : <div className="mt-5 space-y-3"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-high p-3 text-sm text-on-surface" placeholder="Agent name" /><div className="grid grid-cols-2 gap-3"><select value={hostType} onChange={(event) => setHostType(event.target.value as typeof hostType)} className="rounded-xl border border-outline-variant/40 bg-surface-container-high p-3 text-sm text-on-surface"><option value="adk-python">ADK Python</option><option value="claude-code">Claude Code</option><option value="kiro-cli">Kiro CLI</option><option value="custom">Custom</option></select><input value={model} onChange={(event) => setModel(event.target.value)} className="rounded-xl border border-outline-variant/40 bg-surface-container-high p-3 text-sm text-on-surface" placeholder="Model" /></div><button disabled={!gatewayOnline || registering || !displayName.trim()} onClick={connectAgent} className="w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-on-primary disabled:opacity-50">{registering ? 'Registering…' : 'Register and issue key'}</button></div>}</div></div>}
    </div>
  );
}
