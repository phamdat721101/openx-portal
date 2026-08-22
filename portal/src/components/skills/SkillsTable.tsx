'use client';

import React from 'react';
import { SkillItem, SkillStatus } from '@/lib/types';
import { SkillStatusPill } from '@/components/common/StatusBadge';
import { Sparkles, ShieldCheck, Clock, Terminal, Power, RotateCcw, AlertTriangle } from 'lucide-react';

interface SkillsTableProps {
  skills: SkillItem[];
  onStatusChange: (skillId: string, newStatus: SkillStatus) => void;
  onOpenUpload: () => void;
}

export function SkillsTable({ skills, onStatusChange, onOpenUpload }: SkillsTableProps) {
  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
      {/* Table Header & Upload CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-outline-variant/30 bg-surface-container/40">
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface">Registered Skills & Tools Catalog</h3>
          <p className="text-xs text-on-surface-variant">Autonomous tool capabilities executable by buyers</p>
        </div>

        <button
          onClick={onOpenUpload}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-[#33f3ff] transition"
        >
          <Sparkles className="h-4 w-4" />
          Install New Skill (.md)
        </button>
      </div>

      {/* Skills List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-high/30 text-on-surface-variant uppercase tracking-wider font-mono text-[11px]">
              <th className="py-2.5 px-4 font-semibold">Skill Name & Version</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Trigger Patterns</th>
              <th className="py-2.5 px-4 font-semibold">Last Audit / Health</th>
              <th className="py-2.5 px-4 font-semibold">Source</th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {skills.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                  No skills attached to this agent yet.
                </td>
              </tr>
            ) : (
              skills.map((skill) => {
                const isActive = skill.status === 'active';
                const isDeprecated = skill.status === 'deprecated';

                return (
                  <tr key={skill.id} className="hover:bg-surface-container/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-headline font-semibold text-sm text-on-surface">
                          <Terminal className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{skill.name}</span>
                          <span className="font-mono text-[10px] text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">
                            {skill.version}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1 max-w-sm">
                          {skill.description}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <SkillStatusPill status={skill.status} />
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {skill.trigger_patterns.map((pat) => (
                          <span
                            key={pat}
                            className="font-mono text-[10px] rounded bg-surface-container-high px-1.5 py-0.5 text-[#dbfcff] border border-outline-variant/30"
                          >
                            {pat}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {skill.audit_last_run ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
                          <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                          <span>
                            {skill.audit_score ? `${skill.audit_score.toFixed(1)}%` : 'Passed'}
                          </span>
                          <span className="text-[10px] opacity-70">
                            ({new Date(skill.audit_last_run).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-[10px] text-on-surface-variant opacity-60">Pending audit</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="capitalize text-[11px] font-medium text-on-surface-variant">
                        {skill.source.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isActive && (
                        <button
                          onClick={() => onStatusChange(skill.id, 'deprecated')}
                          className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/40 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/10 hover:border-error/40 transition"
                          title="Deprecate Skill"
                        >
                          <Power className="h-3 w-3" />
                          Deprecate
                        </button>
                      )}

                      {isDeprecated && (
                        <button
                          onClick={() => onStatusChange(skill.id, 'active')}
                          className="inline-flex items-center gap-1 rounded-lg border border-secondary/40 px-2.5 py-1 text-xs font-semibold text-secondary hover:bg-secondary/10 transition"
                          title="Reactivate Skill"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reactivate
                        </button>
                      )}

                      {skill.status === 'draft' && (
                        <button
                          onClick={() => onStatusChange(skill.id, 'active')}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/20 border border-primary/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-on-primary transition"
                        >
                          Publish
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
