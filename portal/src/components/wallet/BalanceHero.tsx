import React from 'react';
import { WalletBreakdown } from '@/lib/types';
import { ArrowUpRight, DollarSign, Layers, ShieldCheck, Zap, Bot } from 'lucide-react';

interface BalanceHeroProps {
  totalBalance: number;
  breakdown: WalletBreakdown;
  withdrawThreshold: number;
  cooldownActive: boolean;
  onOpenWithdraw: () => void;
}

export function BalanceHero({
  totalBalance,
  breakdown,
  withdrawThreshold,
  cooldownActive,
  onOpenWithdraw,
}: BalanceHeroProps) {
  const canWithdraw = totalBalance >= withdrawThreshold && !cooldownActive;

  // Calculate percentages for visual breakdown
  const safeTotal = Math.max(0.01, breakdown.credit_share_usdc + breakdown.x402_direct_usdc + breakdown.sub_agent_earnings_usdc);
  const creditPct = Math.round((breakdown.credit_share_usdc / safeTotal) * 100);
  const x402Pct = Math.round((breakdown.x402_direct_usdc / safeTotal) * 100);
  const subAgentPct = Math.round((breakdown.sub_agent_earnings_usdc / safeTotal) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low p-6 transition-all duration-300">
      {/* Background ambient lighting */}
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-agent-accent/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left: Total Withdrawable Balance */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Agent Earnings & Balance
            </span>
            <span className="rounded bg-secondary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-secondary border border-secondary/25">
              Live Settled
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-[#dbfcff]">
              ${totalBalance.toFixed(2)}
            </span>
            <span className="font-mono text-lg font-bold text-primary">USDC</span>
          </div>

          <p className="text-xs text-on-surface-variant mt-2 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
            Min. withdraw threshold: <span className="font-mono text-on-surface">${withdrawThreshold.toFixed(2)} USDC</span>
            {cooldownActive && <span className="text-error font-medium">(24h cooldown active)</span>}
          </p>
        </div>

        {/* Right: Withdraw Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={onOpenWithdraw}
            disabled={!canWithdraw}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-headline text-sm font-bold tracking-wide transition-all duration-200 ${
              canWithdraw
                ? 'bg-primary text-on-primary shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:bg-[#33f3ff] active:scale-95'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60 border border-outline-variant/30'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Withdraw Earnings
          </button>
        </div>
      </div>

      {/* 3-Way Attribution Breakdown Strip */}
      <div className="mt-6 pt-5 border-t border-outline-variant/30">
        <div className="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
          <span>Revenue Attribution Sources</span>
          <span className="font-mono text-[11px]">100% Attributable</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden flex gap-0.5">
          <div className="bg-primary h-full transition-all duration-500" style={{ width: `${creditPct}%` }} title={`Credit Share: ${creditPct}%`} />
          <div className="bg-secondary h-full transition-all duration-500" style={{ width: `${x402Pct}%` }} title={`x402 Direct: ${x402Pct}%`} />
          <div className="bg-agent-accent h-full transition-all duration-500" style={{ width: `${subAgentPct}%` }} title={`Sub-agent: ${subAgentPct}%`} />
        </div>

        {/* Breakdown Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-3">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Layers className="h-3 w-3 text-primary" /> Credit Share
              </span>
              <span className="font-mono text-[11px] text-primary">{creditPct}%</span>
            </div>
            <div className="font-mono text-lg font-bold text-on-surface">
              ${breakdown.credit_share_usdc.toFixed(2)}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">Buyer credit pool deductions</p>
          </div>

          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-3">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Zap className="h-3 w-3 text-secondary" /> x402 Direct
              </span>
              <span className="font-mono text-[11px] text-secondary">{x402Pct}%</span>
            </div>
            <div className="font-mono text-lg font-bold text-on-surface">
              ${breakdown.x402_direct_usdc.toFixed(2)}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">XRPL exact micropayments</p>
          </div>

          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-3">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1">
                <Bot className="h-3 w-3 text-agent-accent" /> Sub-Agent Hires
              </span>
              <span className="font-mono text-[11px] text-agent-accent">{subAgentPct}%</span>
            </div>
            <div className="font-mono text-lg font-bold text-on-surface">
              ${breakdown.sub_agent_earnings_usdc.toFixed(2)}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">Delegated pipeline splits</p>
          </div>
        </div>
      </div>
    </div>
  );
}
