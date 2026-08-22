import React from 'react';
import { ShieldCheck, Sparkles, Brain, Cpu, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { SkillStatus } from '@/lib/types';

interface MatrixChipProps {
  label: string;
  className?: string;
  icon?: boolean;
}

export function MatrixChip({ label, className = '', icon = true }: MatrixChipProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-[11px] font-medium matrix-chip ${className}`}>
      {icon && <ShieldCheck className="h-3 w-3 text-secondary shrink-0" />}
      {label}
    </span>
  );
}

interface SkillStatusPillProps {
  status: SkillStatus;
}

export function SkillStatusPill({ status }: SkillStatusPillProps) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 font-mono text-xs font-semibold text-secondary border border-secondary/25">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2 py-0.5 font-mono text-xs font-medium text-on-surface-variant border border-outline-variant/40">
          <Clock className="h-3 w-3" />
          Draft
        </span>
      );
    case 'deprecated':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-error/10 px-2 py-0.5 font-mono text-xs font-semibold text-error border border-error/25">
          <AlertTriangle className="h-3 w-3" />
          Deprecated
        </span>
      );
  }
}

interface TrainingStagePillProps {
  stage: number; // 0..4
  className?: string;
}

const STAGE_CONFIGS = [
  { label: 'Onboarded', color: 'text-on-surface-variant', bg: 'bg-surface-container-high', icon: Cpu },
  { label: 'Skills Added', color: 'text-primary', bg: 'bg-primary/10 border-primary/30', icon: Cpu },
  { label: 'Evaluated', color: 'text-[#d1bcff]', bg: 'bg-[#d1bcff]/10 border-[#d1bcff]/30', icon: Sparkles },
  { label: 'Orchestrator', color: 'text-agent-accent', bg: 'bg-agent-accent/15 border-agent-accent/40', icon: Brain },
  { label: 'Dreamed', color: 'text-secondary', bg: 'bg-secondary/15 border-secondary/40 shadow-[0_0_10px_rgba(19,255,67,0.15)]', icon: Sparkles },
];

export function TrainingStagePill({ stage, className = '' }: TrainingStagePillProps) {
  const boundedStage = Math.min(Math.max(0, stage), STAGE_CONFIGS.length - 1);
  const config = STAGE_CONFIGS[boundedStage];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${config.bg} ${config.color} ${className}`}
      title={`Training Stage: ${boundedStage} (${config.label})`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="font-headline font-semibold">Stage {boundedStage}: {config.label}</span>
    </span>
  );
}
