import React from 'react';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionText?: string;
  actionHref?: string;
  onClick?: () => void;
  priority?: 'high' | 'medium' | 'low';
}

interface SetupChecklistProps {
  title: string;
  subtitle?: string;
  steps: ChecklistStep[];
  className?: string;
}

export function SetupChecklist({
  title,
  subtitle,
  steps,
  className = '',
}: SetupChecklistProps) {
  const completedCount = steps.filter((s) => s.done).length;
  const progressPercent = Math.round((completedCount / Math.max(1, steps.length)) * 100);

  return (
    <div className={`rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 ${className}`}>
      {/* Header & Score Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-headline text-base font-semibold text-on-surface">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-primary">
            {completedCount}/{steps.length} completed ({progressPercent}%)
          </span>
          <div className="h-2 w-24 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step items */}
      <div className="divide-y divide-outline-variant/20">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-start justify-between gap-3 py-3 transition-colors ${
              step.done ? 'opacity-60' : 'opacity-100'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 shrink-0">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                ) : (
                  <Circle className="h-4 w-4 text-outline" />
                )}
              </div>
              <div>
                <span className={`text-sm font-medium ${step.done ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                  {step.title}
                </span>
                <p className="text-xs text-on-surface-variant/80 mt-0.5">{step.description}</p>
              </div>
            </div>

            {!step.done && (step.actionHref || step.onClick) && (
              <div className="shrink-0">
                {step.actionHref ? (
                  <Link
                    href={step.actionHref}
                    className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-on-primary"
                  >
                    {step.actionText || 'Configure'}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <button
                    onClick={step.onClick}
                    className="inline-flex items-center gap-1 rounded bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-on-primary"
                  >
                    {step.actionText || 'Action'}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
