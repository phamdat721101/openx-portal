'use client';

import React from 'react';
import { PromotedDreamSkill } from '@/lib/types';
import { usePortal } from '@/lib/portalContext';
import { Sparkles, ShieldCheck, Flag, CheckCircle2, Clock, Terminal } from 'lucide-react';

interface SkillifyBoardViewProps {
  agentId: string;
  candidates: PromotedDreamSkill[];
}

export function SkillifyBoardView({ agentId, candidates }: SkillifyBoardViewProps) {
  const { flagSupplierCandidate } = usePortal();

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-secondary" />
            <h3 className="font-headline text-base font-bold text-on-surface">
              Autonomous Skillify Synthesis Board
            </h3>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Skills automatically synthesized during Dream cycles, ready for human-in-the-loop review
          </p>
        </div>

        <span className="font-mono text-xs text-secondary bg-secondary/10 px-2.5 py-1 rounded-lg border border-secondary/25 self-start sm:self-auto">
          Human Gate Active
        </span>
      </div>

      {candidates.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-outline-variant/30 bg-surface-container/30">
          <Terminal className="h-8 w-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
          <p className="text-xs text-on-surface-variant">
            No newly synthesized skills yet. They will appear here following next REM consolidation cycle.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {candidates.map((candidate) => {
            const isPendingReview = candidate.candidate_status === 'pending_human_review';
            const isApproved = candidate.candidate_status === 'approved';

            return (
              <div
                key={candidate.skill_id}
                className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-4 flex flex-col justify-between space-y-3 transition hover:border-secondary/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-headline text-sm font-bold text-on-surface flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-secondary shrink-0" />
                      {candidate.name}
                    </span>
                    <span className="font-mono text-[10px] rounded bg-secondary/15 px-1.5 py-0.5 text-secondary border border-secondary/30 font-bold">
                      {candidate.confidence_score.toFixed(1)}% Conf
                    </span>
                  </div>

                  <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                    {candidate.description}
                  </p>

                  <div className="mt-2 font-mono text-[10px] text-on-surface-variant/70">
                    Hash: {candidate.artifact_hash}
                  </div>
                </div>

                <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <div>
                    {isPendingReview && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-primary">
                        <Clock className="h-3 w-3" /> Under Review
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-secondary">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {candidate.candidate_status === 'unflagged' && (
                      <span className="text-[11px] text-on-surface-variant">Ready for review</span>
                    )}
                  </div>

                  {candidate.candidate_status === 'unflagged' && (
                    <button
                      onClick={() => flagSupplierCandidate(agentId, candidate.skill_id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-agent-accent px-3 py-1.5 text-xs font-bold text-on-agent-accent shadow-[0_0_10px_rgba(124,92,255,0.2)] hover:bg-[#6e46ff] transition active:scale-95"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Flag for OpenX Review
                    </button>
                  )}

                  {isPendingReview && (
                    <span className="rounded-lg bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-on-surface-variant border border-outline-variant/30">
                      Logged in candidate DB
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
