import React from 'react';
import { DreamCycleState } from '@/lib/types';
import { Moon, Sparkles, Activity, Brain, Database, Cpu, Zap, CheckCircle2 } from 'lucide-react';

interface DreamTelemetryProps {
  state: DreamCycleState;
}

export function DreamTelemetry({ state }: DreamTelemetryProps) {
  const isREM = state.rem_state === 'ACTIVE_REM';

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
                <Database className="h-3 w-3 text-secondary" /> Memory
              </span>
              <div className="font-mono text-lg font-bold text-on-surface">{state.memory_nodes_total.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Brain className="h-3 w-3 text-agent-accent" /> Buffer
              </span>
              <div className="font-mono text-lg font-bold text-on-surface">{state.wake_context.active_memory_buffer_mb} MB</div>
            </div>
          </div>
        </div>

        {/* Morning Brief Digest */}
        <div className="mt-5 rounded-xl border border-outline-variant/20 bg-surface-container/70 p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface mb-1.5 uppercase tracking-wider">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Autonomous Morning Brief Summary</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {state.wake_context.last_morning_brief_summary}
          </p>
        </div>
      </div>

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
