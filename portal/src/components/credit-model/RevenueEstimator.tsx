'use client';

import React, { useState } from 'react';
import { Calculator, TrendingUp, Users, DollarSign, Layers } from 'lucide-react';

interface RevenueEstimatorProps {
  currentPrice: number;
}

export function RevenueEstimator({ currentPrice }: RevenueEstimatorProps) {
  const [estimatedDailyCalls, setEstimatedDailyCalls] = useState<number>(250);
  const [activeBuyers, setActiveBuyers] = useState<number>(35);

  const price = Math.max(0.01, currentPrice);
  const dailyGross = estimatedDailyCalls * price;
  const creatorDailyNet = dailyGross * 0.85;
  const creatorMonthlyNet = creatorDailyNet * 30;

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="rounded-xl bg-primary/10 p-2 text-primary border border-primary/20">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface">Revenue Projection Simulator</h3>
          <p className="text-xs text-on-surface-variant">Forecast monthly creator yield at current pricing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Sliders */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-1.5">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Daily Execution Volume
              </span>
              <span className="font-mono text-primary font-bold">{estimatedDailyCalls.toLocaleString()} calls/day</span>
            </div>
            <input
              type="range"
              min="10"
              max="5000"
              step="10"
              value={estimatedDailyCalls}
              onChange={(e) => setEstimatedDailyCalls(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-on-surface mb-1.5">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-secondary" /> Active Unique Buyers
              </span>
              <span className="font-mono text-secondary font-bold">{activeBuyers} buyers</span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={activeBuyers}
              onChange={(e) => setActiveBuyers(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-secondary"
            />
          </div>

          <div className="rounded-xl bg-surface-container/60 p-3 border border-outline-variant/20 text-xs text-on-surface-variant">
            <span>Configured Price: </span>
            <span className="font-mono font-bold text-on-surface">${price.toFixed(2)} USDC / call</span>
            <span className="opacity-70"> (Platform fee: 15%)</span>
          </div>
        </div>

        {/* Projection Outputs */}
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-surface-container to-surface-container-high p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(0,240,255,0.08)]">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Estimated Net Creator Revenue
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono text-3xl sm:text-4xl font-extrabold text-[#dbfcff]">
                ${creatorMonthlyNet.toFixed(2)}
              </span>
              <span className="font-mono text-xs font-bold text-primary">USDC / Month</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-outline-variant/30 text-xs">
            <div>
              <span className="text-on-surface-variant text-[11px]">Daily Net Yield</span>
              <div className="font-mono font-bold text-secondary text-base">
                ${creatorDailyNet.toFixed(2)} USDC
              </div>
            </div>
            <div>
              <span className="text-on-surface-variant text-[11px]">Avg / Buyer Monthly</span>
              <div className="font-mono font-bold text-on-surface text-base">
                ${(creatorMonthlyNet / Math.max(1, activeBuyers)).toFixed(2)} USDC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
