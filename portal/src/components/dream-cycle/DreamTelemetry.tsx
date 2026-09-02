import React from 'react';
import { DreamCycleState } from '@/lib/types';
import { usePortal } from '@/lib/portalContext';
import { dreamRunStreamUrl, fetchDreamLessons, fetchDreamState, fetchWakeContext, reconcileDreamRun, syncCompletedDreamRun, DreamLesson, DreamTriggerResponse, WakeContextResponse } from '@/lib/api/agentGateway';
import { Moon, Sparkles, Activity, Brain, Database, ShieldCheck, CheckCircle2, Copy, Check, Loader2, ListOrdered, Terminal } from 'lucide-react';
import { ZeroGMemoryVaultView } from './ZeroGMemoryVaultView';

interface DreamTelemetryProps {
  agentId: string;
  state: DreamCycleState;
}

const morningBriefText = (dailyDigest: unknown, fallback?: string): string | undefined => {
  if (typeof dailyDigest === 'string' && dailyDigest.trim()) return dailyDigest;
  if (!dailyDigest || typeof dailyDigest !== 'object') return fallback;

  const digest = dailyDigest as Record<string, unknown>;
  if (typeof digest.summary_narrative === 'string' && digest.summary_narrative.trim()) {
    return digest.summary_narrative;
  }

  const metrics = [
    ['episodes consolidated', digest.episodes_consolidated],
    ['memories added', digest.memories_added],
    ['memories pruned', digest.memories_pruned],
    ['contradictions resolved', digest.contradictions_resolved],
  ].flatMap(([label, value]) => typeof value === 'number' && Number.isFinite(value) ? [`${value} ${label}`] : []);

  return metrics.length > 0 ? `Dream cycle completed: ${metrics.join(', ')}.` : fallback;
};

export function DreamTelemetry({ agentId, state }: DreamTelemetryProps) {
  const { triggerDreamCycle, showToast } = usePortal();
  const isREM = state.rem_state === 'ACTIVE_REM';
  const [run, setRun] = React.useState<NonNullable<DreamTriggerResponse['run']> | null>(null);
  const [wakeData, setWakeData] = React.useState<WakeContextResponse | null>(null);
  const [lessons, setLessons] = React.useState<DreamLesson[]>([]);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [syncingExternalResult, setSyncingExternalResult] = React.useState(false);

  const loadWakeContext = React.useCallback(async () => {
    const data = await fetchWakeContext(agentId);
    if (data) setWakeData(data);
  }, [agentId]);

  React.useEffect(() => {
    loadWakeContext();
    void fetchDreamLessons(agentId).then(setLessons);
    void fetchDreamState(agentId).then((data) => { if (data?.latest_run) setRun(data.latest_run); });
  }, [loadWakeContext]);

  React.useEffect(() => {
    if (!run || run.status !== 'running') return;
    const source = new EventSource(dreamRunStreamUrl(agentId, run.id));
    source.addEventListener('run_status', (event) => {
      const next = JSON.parse((event as MessageEvent).data);
      setRun(next);
      if (next.status !== 'running') {
        source.close();
        loadWakeContext();
        void fetchDreamLessons(agentId).then(setLessons);
      }
    });
    return () => source.close();
  }, [agentId, run?.status, loadWakeContext]);

  const trigger = async () => {
    const result = await triggerDreamCycle(agentId);
    if (!result.success) {
      showToast(result.paymentRequired ? 'Payment quote required. Settle it in your connected XRPL wallet, then retry.' : result.error || 'Dream Cycle could not be started.', 'error');
      return;
    }
    if (result.run) setRun(result.run);
    else if (result.runId) setRun({ id: result.runId, status: 'running' });
  };

  const refreshRunStatus = async () => {
    const result = await reconcileDreamRun(agentId);
    if (!result.ok || !result.run) { showToast(result.error || 'Unable to refresh Dream status.', 'error'); return; }
    setRun(result.run);
  };
  const syncExternalResult = async () => {
    setSyncingExternalResult(true);
    const result = await syncCompletedDreamRun(agentId);
    setSyncingExternalResult(false);
    if (!result.ok || !result.run) { showToast(result.error || 'No completed HyperMove result is available yet.', 'error'); return; }
    setRun(result.run);
    void fetchDreamLessons(agentId).then(setLessons);
    void loadWakeContext();
    showToast(result.imported ? 'Completed HyperMove Dream data synced to the Portal.' : 'Portal already has the latest HyperMove Dream data.', 'success');
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const activeConstraints = wakeData?.effective_constraints || wakeData?.upstream?.active_constraints || [];
  const morningBrief = morningBriefText(wakeData?.upstream?.daily_digest, state.wake_context?.last_morning_brief_summary);
  const promptInjection = wakeData?.upstream?.system_prompt_injection;

  return (
    <div className="space-y-6">
      {/* Top Banner: Real-time REM State & Wake Context */}
      <div className="relative overflow-hidden rounded-2xl border border-agent-accent/40 bg-surface-container-low p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            {/* Pulsing Visual REM Indicator */}
            <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-agent-accent/15 border border-agent-accent/30 shrink-0">
              <Moon className="h-7 w-7 text-agent-accent" />
              {isREM && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-secondary" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-headline text-lg font-bold text-on-surface">
                  {state.hypermove_dream_agent_id}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  isREM
                    ? 'bg-secondary/15 text-secondary border border-secondary/30 animate-rem-pulse'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {state.rem_state.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Last consolidated cycle: {state.last_cycle_at ? new Date(state.last_cycle_at).toLocaleString() : 'Just now'}
              </p>
            </div>
          </div>

          <button
            onClick={trigger}
            disabled={isREM || state.rem_state === 'CONSOLIDATING' || run?.status === 'running'}
            className="flex items-center gap-2 rounded-xl bg-agent-accent px-5 py-2.5 font-headline text-xs font-bold text-on-agent-accent shadow-[0_0_15px_rgba(124,92,255,0.25)] hover:bg-[#6e46ff] transition active:scale-95 disabled:opacity-50"
          >
            {run?.status === 'running' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Dream Consolidating...</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span>Run Dream Cycle</span>
              </>
            )}
          </button>
          {run?.status === 'running' && (
            <button onClick={refreshRunStatus} className="rounded-xl border border-outline-variant/50 px-4 py-2.5 font-headline text-xs font-bold text-on-surface hover:bg-surface-container">
              Refresh status
            </button>
          )}
          <button onClick={syncExternalResult} disabled={syncingExternalResult || run?.status === 'running'} className="flex items-center gap-2 rounded-xl border border-secondary/50 px-4 py-2.5 font-headline text-xs font-bold text-secondary hover:bg-secondary/10 disabled:opacity-50">
            {syncingExternalResult ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing result…</> : 'Sync completed Dream data'}
          </button>

          {/* Aggregate Telemetry Counts */}
          <div className="grid grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-outline-variant/30 pt-4 lg:pt-0 lg:pl-6">
            <div>
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" /> Cycles
              </span>
              <div className="font-mono text-lg font-bold text-on-surface">{state.cycle_count_total}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Database className="h-3 w-3 text-secondary" /> Memories
              </span>
              <div className="font-mono text-lg font-bold text-on-surface">{wakeData?.upstream?.memories_count || state.memory_nodes_total}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Brain className="h-3 w-3 text-agent-accent" /> Constraints
              </span>
              <div className="font-mono text-lg font-bold text-on-surface">{activeConstraints.length}</div>
            </div>
          </div>
        </div>

        {/* Morning Brief Digest */}
        {morningBrief && (
          <div className="mt-5 rounded-xl border border-outline-variant/20 bg-surface-container/70 p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface mb-1.5 uppercase tracking-wider">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Autonomous Morning Brief Summary</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {morningBrief}
            </p>
          </div>
        )}
      </div>

      {/* Live Stream & Completed Stage Summaries */}
      {run && (
        <div className="rounded-2xl border border-agent-accent/30 bg-surface-container-low p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-agent-accent" />
              <span className="font-headline text-sm font-bold text-on-surface">
                Dream Run Lifecycle: <span className="font-mono uppercase text-agent-accent">{run.status}</span>
              </span>
            </div>
            {run.status === 'running' && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {run.reconciliation?.last_error ? 'Status unavailable — retrying safely' : 'Reconciling HyperMove status'}
              </span>
            )}
          </div>

          {run.result?.stage_summaries && Object.keys(run.result.stage_summaries).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {Object.entries(run.result.stage_summaries).map(([stage, summary]) => (
                <div key={stage} className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono font-bold text-primary capitalize">
                    <span>{stage.replace(/_/g, ' ')}</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-secondary" />
                  </div>
                  <pre className="text-[11px] text-on-surface-variant font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                    {typeof summary === 'object' ? JSON.stringify(summary, null, 2) : String(summary)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            run.status === 'running' && (
              <p className="text-xs text-on-surface-variant">{run.reconciliation?.last_error || 'Waiting for HyperMove to report a terminal Dream status...'}</p>
            )
          )}
          {run.settlement && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-on-surface-variant">
              <span className="font-semibold text-secondary">XRPL settlement {run.settlement.status}</span>
              <span className="ml-2 font-mono">{run.settlement.amount} {run.settlement.currency}</span>
              {run.settlement.transaction_hash && <span className="ml-2 font-mono">tx {run.settlement.transaction_hash.slice(0, 12)}…</span>}
              {run.settlement.reason && <span className="ml-2 text-error">{run.settlement.reason}</span>}
            </div>
          )}
          {run.learning_brief?.morning_brief && <p className="text-xs text-on-surface-variant">Learning brief: {run.learning_brief.morning_brief}</p>}
        </div>
      )}

      {/* Active & Learned Constraints */}
      {wakeData?.source === 'cache' && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-on-surface-variant">
          {wakeData.warning || `Showing cached wake context from ${wakeData.cached_at ? new Date(wakeData.cached_at).toLocaleString() : 'the last successful request'}.`}
        </p>
      )}
      {activeConstraints.length > 0 && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            <h3 className="font-headline text-sm font-bold text-on-surface">
              Learned Operational Constraints ({activeConstraints.length} Active)
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeConstraints.map((c: any, index: number) => {
              const label = c.type || (c.lesson_id ? 'openx_constraint' : 'learned_rule');
              const text = c.content || c.text || c.constraint || JSON.stringify(c);
              return (
                <div key={index} className="rounded-xl border border-outline-variant/20 bg-surface-container/50 p-3 space-y-1">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-secondary/15 text-secondary">
                    {label}
                  </span>
                  <p className="text-xs text-on-surface leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-agent-accent" />
            <h3 className="font-headline text-sm font-bold text-on-surface">Dream Lessons</h3>
          </div>
          <span className="font-mono text-[10px] text-on-surface-variant">{lessons.length} retained</span>
        </div>
        {lessons.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No managed lessons yet. Completed Dream runs can add lessons for review.</p>
        ) : (
          <div className="space-y-2">
            {lessons.slice(0, 8).map((lesson) => (
              <div key={lesson.id} className="rounded-xl border border-outline-variant/20 bg-surface-container/50 p-3">
                <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-mono">
                  <span className="text-primary">{lesson.source.replace('_', ' ')}</span>
                  <span className="text-on-surface-variant">{lesson.state.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
                <p className="text-xs leading-relaxed text-on-surface">{lesson.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ZeroGMemoryVaultView agentId={agentId} lessons={lessons} />

      {/* System Prompt Injection Snippet */}
      {promptInjection && (
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <h3 className="font-headline text-sm font-bold text-on-surface">System Prompt Injection Snippet</h3>
            </div>
            <button
              onClick={() => handleCopyPrompt(promptInjection)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30 text-xs font-semibold text-on-surface hover:bg-surface-container"
            >
              {copiedPrompt ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedPrompt ? 'Copied!' : 'Copy Snippet'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-surface-container-highest/60 text-on-surface font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-40 border border-outline-variant/20">
            {promptInjection}
          </pre>
        </div>
      )}

      {/* Episode Diagnostics Table */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 bg-surface-container/40">
          <h3 className="font-headline text-base font-bold text-on-surface">Dream Episode Diagnostics</h3>
          <p className="text-xs text-on-surface-variant">Telemetry from recent autonomous offline consolidation runs</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-high/30 text-on-surface-variant uppercase tracking-wider font-mono text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Episode ID</th>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Duration</th>
                <th className="py-2.5 px-4 font-semibold">Loss Entropy</th>
                <th className="py-2.5 px-4 font-semibold">Synthesized Insights</th>
                <th className="py-2.5 px-4 font-semibold text-right">Convergence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-mono">
              {state.diagnostics.map((ep) => (
                <tr key={ep.episode_id} className="hover:bg-surface-container/60 transition-colors">
                  <td className="py-3 px-4 text-primary font-bold">{ep.episode_id}</td>
                  <td className="py-3 px-4 text-on-surface-variant">
                    {new Date(ep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 text-on-surface">{ep.duration_sec}s</td>
                  <td className="py-3 px-4 text-secondary">{ep.loss_entropy.toFixed(3)}</td>
                  <td className="py-3 px-4 text-on-surface">{ep.synthesized_insights} items</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                      <CheckCircle2 className="h-3 w-3" /> Converged
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
