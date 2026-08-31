'use client';

import React, { useEffect, useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { fetchDreamReadiness } from '@/lib/api/agentGateway';
import { Moon, ShieldCheck, AlertCircle, Loader2, Link2 } from 'lucide-react';

interface DreamLinkCTAProps {
  agentId: string;
}

export function DreamLinkCTA({ agentId }: DreamLinkCTAProps) {
  const { setupDreamCycle } = usePortal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<string | null>(null);
  const [canSetup, setCanSetup] = useState(false);

  const checkReadiness = async () => {
    const result = await fetchDreamReadiness(agentId);
    if (!result.ok) { setReadiness(result.message || result.error || 'Gateway readiness check failed.'); setCanSetup(false); return; }
    setCanSetup(Boolean(result.self_service_enabled && result.hypermove_mcp_configured && result.using_service_credential));
    setReadiness(result.ready ? 'HyperMove service is ready. Set up Dream Cycle with one click.' : result.message || 'Dream setup is not ready yet.');
  };

  useEffect(() => { void checkReadiness(); }, [agentId]);

  const handleVerifyAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const res = await setupDreamCycle(agentId);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Dream setup failed. Review the Gateway readiness message and retry.');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-agent-accent/40 bg-surface-container-low p-6 md:p-8">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-agent-accent/15 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="rounded-xl bg-agent-accent/15 p-2 text-agent-accent border border-agent-accent/30">
            <Moon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">
              HyperMove Autonomous Dream Cycle
            </h2>
            <span className="font-mono text-xs text-agent-accent">
              Continuous Memory Replay & Autonomous Skill Synthesis
            </span>
          </div>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mt-2">
          Dream Cycle bridges your agent with HyperMove's offline REM consolidation engine. When idle, your agent replays past execution episodes, consolidates long-term memory embeddings, and autonomously synthesizes new candidate skills for OpenX marketplace review.
        </p>

        {/* Server-managed setup notice */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-4 mt-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            <span>Server-Managed Dream Setup</span>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-normal">
            Your connected OpenX agent ID becomes the stable HyperMove Dream ID. The Gateway checks readiness and sends future execution telemetry as idempotent episodes. Public setup is enabled only when the operator opts in on the Gateway.
          </p>
        </div>

        <form onSubmit={handleVerifyAndLink} className="mt-6 space-y-4">
          <p className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3 text-xs text-on-surface-variant">OpenX Portal provisions this agent’s HyperMove Dream namespace through the Gateway. No agent key or HyperMove token is stored in your browser.</p>
          <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={checkReadiness} className="inline-flex items-center justify-center rounded-xl border border-outline-variant/50 px-4 py-3 font-headline text-xs font-bold text-on-surface hover:bg-surface-container">
                Check readiness
              </button>
              <button type="submit" disabled={loading || !canSetup} className="inline-flex items-center justify-center gap-2 rounded-xl bg-agent-accent px-6 py-3 font-headline text-xs font-bold text-on-agent-accent shadow-[0_0_15px_rgba(124,92,255,0.3)] hover:bg-[#6e46ff] transition active:scale-95 disabled:opacity-50">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Set Up Dream Cycle
                  </>
                )}
              </button>
          </div>

          {error && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-3 flex items-center gap-2 text-xs text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {readiness && <p className="text-xs text-on-surface-variant">{readiness}</p>}
        </form>
      </div>
    </div>
  );
}
