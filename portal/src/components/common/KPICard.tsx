import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: string;
  isPositive?: boolean;
  icon?: LucideIcon;
  subtext?: string;
  highlight?: 'cyan' | 'green' | 'violet' | 'none';
}

export function KPICard({
  label,
  value,
  delta,
  isPositive = true,
  icon: Icon,
  subtext,
  highlight = 'none',
}: KPICardProps) {
  const borderClasses = {
    cyan: 'border-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.08)]',
    green: 'border-secondary/30 shadow-[0_0_15px_rgba(19,255,67,0.08)]',
    violet: 'border-agent-accent/40 shadow-[0_0_15px_rgba(124,92,255,0.12)]',
    none: 'border-outline-variant/30',
  }[highlight];

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-surface-container-low p-4 transition-all duration-200 hover:border-outline-variant/60 ${borderClasses}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className="rounded-lg bg-surface-container-high p-1.5 text-on-surface-variant">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight text-on-surface">{value}</span>
        {delta && (
          <div
            className={`flex items-center text-xs font-semibold ${
              isPositive ? 'text-secondary' : 'text-error'
            }`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {delta}
          </div>
        )}
      </div>

      {subtext && <p className="mt-1 text-[11px] text-on-surface-variant/80 font-normal">{subtext}</p>}
    </div>
  );
}
