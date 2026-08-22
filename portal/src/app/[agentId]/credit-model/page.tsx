'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { OperatingRulesCard } from '@/components/credit-model/OperatingRulesCard';
import { RevenueEstimator } from '@/components/credit-model/RevenueEstimator';

export default function CreditModelPage({ params }: { params: { agentId: string } }) {
  const { getCreditModel } = usePortal();
  const config = getCreditModel(params.agentId);

  return (
    <div className="space-y-6">
      {/* 1. Operating Rules Card (Crossmint-inspired) */}
      <OperatingRulesCard agentId={params.agentId} config={config} />

      {/* 2. Interactive Revenue Projection Simulator */}
      <RevenueEstimator currentPrice={config.price_usdc} />
    </div>
  );
}
