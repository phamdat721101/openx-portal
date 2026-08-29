'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { OperatingRulesCard } from '@/components/credit-model/OperatingRulesCard';
import { TokenConsumptionCard } from '@/components/credit-model/TokenConsumptionCard';

export default function CreditModelPage({ params }: { params: { agentId: string } }) {
  const { getCreditModel } = usePortal();
  const config = getCreditModel(params.agentId);

  return (
    <div className="space-y-6">
      {/* 1. Operating Rules Card (OpenX Pricing Engine) */}
      <OperatingRulesCard agentId={params.agentId} config={config} />
      <TokenConsumptionCard agentId={params.agentId} />
    </div>
  );
}
