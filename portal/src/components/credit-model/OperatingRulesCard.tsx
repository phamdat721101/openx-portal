'use client';

import React, { useState } from 'react';
import { CreditModelConfig } from '@/lib/types';
import { usePortal } from '@/lib/portalContext';
import { Sliders, Save, CheckCircle2, ShieldAlert, Sparkles, DollarSign, Gift, Gauge } from 'lucide-react';

interface OperatingRulesCardProps {
  agentId: string;
  config: CreditModelConfig;
}

export function OperatingRulesCard({ agentId, config }: OperatingRulesCardProps) {
  const { updateCreditModel } = usePortal();
  const [price, setPrice] = useState<number>(config.price_usdc);
  const [freeTrials, setFreeTrials] = useState<number>(config.free_trial_calls);
  const [dailyLimit, setDailyLimit] = useState<number>(config.per_buyer_daily_limit);
  const [saving, setSaving] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    updateCreditModel(agentId, {
      price_usdc: Number(price),
      free_trial_calls: Number(freeTrials),
      per_buyer_daily_limit: Number(dailyLimit),
    });
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-agent-accent/15 p-2 text-agent-accent border border-agent-accent/30">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-headline text-base font-bold text-on-surface">
              Monetization & Operating Rules Object
            </h3>
            <p className="text-xs text-on-surface-variant">
              Post-publish paywall and buyer access configuration (merged into agents.pricing)
            </p>
          </div>
        </div>

        <span className="font-mono text-xs text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-lg border border-outline-variant/30 self-start sm:self-auto">
          Last updated: {new Date(config.updated_at).toLocaleDateString()}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rule 1: Price Per Call */}
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-4 transition hover:border-primary/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                <DollarSign className="h-4 w-4 text-primary" /> Price Per Call
              </span>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                85% Creator Share
              </span>
            </div>

            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-on-surface-variant">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest pl-7 pr-16 py-2.5 font-mono text-lg font-bold text-on-surface focus:border-primary focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-primary font-semibold">
                USDC
              </span>
            </div>

            <p className="text-[11px] text-on-surface-variant mt-2">
              Deducted per execution via credit pool or exact x402 micropayment.
            </p>
          </div>

          {/* Rule 2: Free-Trial Calls */}
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-4 transition hover:border-secondary/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                <Gift className="h-4 w-4 text-secondary" /> Free Trials
              </span>
              <span className="rounded bg-secondary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary">
                Per New Buyer
              </span>
            </div>

            <div className="relative mt-2">
              <input
                type="number"
                min="0"
                max="50"
                value={freeTrials}
                onChange={(e) => setFreeTrials(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 font-mono text-lg font-bold text-on-surface focus:border-secondary focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-on-surface-variant">
                Calls
              </span>
            </div>

            <p className="text-[11px] text-on-surface-variant mt-2">
              Number of complimentary zero-cost queries granted to first-time wallets.
            </p>
          </div>

          {/* Rule 3: Per-Buyer Daily Limit */}
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-4 transition hover:border-agent-accent/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5 uppercase tracking-wider">
                <Gauge className="h-4 w-4 text-agent-accent" /> Daily Rate Limit
              </span>
              <span className="rounded bg-agent-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-agent-accent">
                Rate Quota
              </span>
            </div>

            <div className="relative mt-2">
              <input
                type="number"
                min="1"
                max="10000"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 font-mono text-lg font-bold text-on-surface focus:border-agent-accent focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-on-surface-variant">
                Max/Day
              </span>
            </div>

            <p className="text-[11px] text-on-surface-variant mt-2">
              Maximum allowed daily executions per single buyer wallet to prevent throttling.
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Changes take effect immediately across all client routing nodes.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-on-primary shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-[#33f3ff] transition active:scale-95"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Operating Rules'}
          </button>
        </div>
      </form>
    </div>
  );
}
