'use client';

import React, { useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { BalanceHero } from '@/components/wallet/BalanceHero';
import { WithdrawModal } from '@/components/wallet/WithdrawModal';
import { LedgerTable } from '@/components/wallet/LedgerTable';
import { SetupChecklist } from '@/components/common/SetupChecklist';

export default function WalletPage({ params }: { params: { agentId: string } }) {
  const { getWalletData } = usePortal();
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const wallet = getWalletData(params.agentId);

  const hasMetThreshold = wallet.total_withdrawable_usdc >= wallet.withdraw_threshold_usdc;

  const checklistSteps = [
    {
      id: 'step_threshold',
      title: 'Meet minimum withdrawal balance',
      description: `Current: $${wallet.total_withdrawable_usdc.toFixed(2)} USDC / Threshold: $${wallet.withdraw_threshold_usdc.toFixed(2)} USDC`,
      done: hasMetThreshold,
      actionText: 'Earn more via buyer calls',
      actionHref: `/${params.agentId}/skills`,
    },
    {
      id: 'step_cooldown',
      title: 'Pass 24-hour security cooldown check',
      description: wallet.withdraw_cooldown_active ? 'Cooldown active after recent update' : 'Security cooldown clear',
      done: !wallet.withdraw_cooldown_active,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Headline Balance Hero & 3-Way Attribution */}
      <BalanceHero
        totalBalance={wallet.total_withdrawable_usdc}
        breakdown={wallet.breakdown}
        withdrawThreshold={wallet.withdraw_threshold_usdc}
        cooldownActive={wallet.withdraw_cooldown_active}
        onOpenWithdraw={() => setWithdrawModalOpen(true)}
      />

      {/* 2. SetupChecklist (Toku-inspired threshold progress) */}
      {!hasMetThreshold && (
        <SetupChecklist
          title="Withdrawal Eligibility Progress"
          subtitle="Complete threshold requirements to enable direct on-chain fund withdrawals"
          steps={checklistSteps}
        />
      )}

      {/* 3. Transaction History & Audit Ledger */}
      <LedgerTable items={wallet.ledger} />

      {/* Interactive Withdraw Modal */}
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        agentId={params.agentId}
        maxAmount={wallet.total_withdrawable_usdc}
      />
    </div>
  );
}
