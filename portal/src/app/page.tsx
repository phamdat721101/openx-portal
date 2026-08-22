'use client';

import React from 'react';
import Link from 'next/link';
import { usePortal } from '@/lib/portalContext';
import { KPICard } from '@/components/common/KPICard';
import { TrainingStagePill, MatrixChip } from '@/components/common/StatusBadge';
import { Bot, DollarSign, Users, Award, ArrowRight, PlusCircle, Sparkles, Moon, ExternalLink, ShieldCheck } from 'lucide-react';

export default function FleetPickerPage() {
  const { authenticated, login, agents } = usePortal();

  // Calculate aggregates
  const totalRevenue = agents.reduce((acc, a) => acc + a.kpis.revenue_usdc_mtd, 0);
  const totalHires = agents.reduce((acc, a) => acc + a.kpis.hires_mtd, 0);
  const avgReputation = (
    agents.reduce((acc, a) => acc + a.kpis.reputation_score, 0) / Math.max(1, agents.length)
  ).toFixed(1);

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-agent-accent/15 text-agent-accent border border-agent-accent/30 shadow-[0_0_30px_rgba(124,92,255,0.25)]">
          <Bot className="h-8 w-8" />
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface">OpenX Agent Portal</h1>
        <p className="max-w-md text-sm text-on-surface-variant mt-2 mb-6 leading-relaxed">
          Connect your creator wallet to manage your AI agent fleet, withdraw earnings, attach skills, configure monetization rules, and inspect Dream Cycle telemetry.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:bg-[#33f3ff] transition"
        >
          Sign In with Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
            Agent Fleet Cockpit
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Operator management console for your active OpenX autonomous agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MatrixChip label="Cryptographically Verified" />
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total Fleet Revenue (MTD)"
          value={`$${totalRevenue.toFixed(2)}`}
          delta="+18.4% vs last month"
          isPositive={true}
          icon={DollarSign}
          highlight="cyan"
        />
        <KPICard
          label="Total Agent Hires (MTD)"
          value={totalHires}
          delta="+24 queries"
          isPositive={true}
          icon={Users}
          highlight="green"
        />
        <KPICard
          label="Avg Fleet Reputation"
          value={`${avgReputation}/100`}
          delta="Top 5% on OpenX"
          isPositive={true}
          icon={Award}
          highlight="violet"
        />
      </div>

      {/* Agents Grid Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>Your Managed Agents ({agents.length})</span>
          </h2>
          <span className="text-xs text-on-surface-variant font-mono">
            Click agent to open management cockpit
          </span>
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => {
            const hasDreamLinked = !!agent.hypermove_dream_agent_id;

            return (
              <Link
                key={agent.id}
                href={`/${agent.id}/wallet`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_25px_rgba(0,240,255,0.12)] agent-card-border"
              >
                <div>
                  {/* Top Bar: Stage & Dream Tag */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <TrainingStagePill stage={agent.training_stage} />
                    {hasDreamLinked ? (
                      <span className="inline-flex items-center gap-1 rounded bg-secondary/15 px-2 py-0.5 font-mono text-[10px] font-bold text-secondary border border-secondary/30">
                        <Moon className="h-2.5 w-2.5" /> REM Active
                      </span>
                    ) : (
                      <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
                        Unlinked
                      </span>
                    )}
                  </div>

                  {/* Agent Display Name */}
                  <h3 className="font-headline text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                    {agent.display_name}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>
                </div>

                {/* Metrics Footer */}
                <div className="mt-5 pt-4 border-t border-outline-variant/20">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase">Revenue (MTD)</span>
                      <div className="font-bold text-on-surface text-sm">
                        ${agent.kpis.revenue_usdc_mtd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant uppercase">Hires</span>
                      <div className="font-bold text-secondary text-sm">
                        {agent.kpis.hires_mtd}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                    <span>Open Cockpit</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
