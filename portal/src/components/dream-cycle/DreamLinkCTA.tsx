'use client';

import React, { useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { Moon, ShieldCheck, Sparkles, AlertCircle, ArrowRight, Loader2, Link2 } from 'lucide-react';

interface DreamLinkCTAProps {
  agentId: string;
}

export function DreamLinkCTA({ agentId }: DreamLinkCTAProps) {
  const { linkDreamCycle } = usePortal();
  const [hypermoveAgentId, setHypermoveAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hypermoveAgentId.trim() || loading) return;

    setError(null);
    setLoading(true);

    const res = await linkDreamCycle(agentId, hypermoveAgentId.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Verification failed. Agent ID not found in your HyperMove session.');
    }
  };

  const fillExample = () => {
    setHypermoveAgentId('hypermove_agent_defi_analyst_09');
    setError(null);
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

        {/* 8-Step Verification Safety Notice */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-4 mt-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            <span>Server-Verified Ownership Verification (Step 6-8)</span>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-normal">
            To prevent unauthorized telemetry reads, entered <code className="font-mono text-primary">agent_id</code> values are verified server-side against HyperMove's <code className="font-mono text-primary">list_my_dream_agent_ids</code> session before saving.
          </p>
        </div>

        {/* Link Form */}
        <form onSubmit={handleVerifyAndLink} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Enter your HyperMove Agent ID
              </label>
              <button
                type="button"
                onClick={fillExample}
                className="text-[11px] text-primary hover:underline font-mono"
              >
                Use sample ID
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={hypermoveAgentId}
                onChange={(e) => {
                  setHypermoveAgentId(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. hypermove_agent_defi_analyst_09"
                className="flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 font-mono text-sm text-on-surface focus:border-agent-accent focus:outline-none"
              />

              <button
                type="submit"
                disabled={loading || !hypermoveAgentId.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-agent-accent px-6 py-3 font-headline text-xs font-bold text-on-agent-accent shadow-[0_0_15px_rgba(124,92,255,0.3)] hover:bg-[#6e46ff] transition active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Verify & Link Agent
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-3 flex items-center gap-2 text-xs text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
