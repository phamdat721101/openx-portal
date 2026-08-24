'use client';

import React, { useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { X, ArrowUpRight, ShieldCheck, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  maxAmount: number;
}

export function WithdrawModal({ isOpen, onClose, agentId, maxAmount }: WithdrawModalProps) {
  const { withdrawFunds, activeWallet } = usePortal();
  const [amount, setAmount] = useState<string>(maxAmount.toFixed(2));
  const [loading, setLoading] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= 5.0 && numAmount <= maxAmount;

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    const result = await withdrawFunds(agentId, numAmount);
    setLoading(false);

    if (result.success) {
      setTxSuccess(result.txHash);
      setTimeout(() => {
        setTxSuccess(null);
        onClose();
      }, 2200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-outline-variant/40 bg-surface-container-high p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="rounded-xl bg-primary/10 p-2 text-primary border border-primary/20">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Withdraw Agent Revenue</h2>
            <p className="text-xs text-on-surface-variant">Instant settlement to owner wallet via XRPL (RLUSD)</p>
          </div>
        </div>

        {txSuccess ? (
          <div className="py-8 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15 text-secondary border border-secondary/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-headline text-base font-bold text-on-surface">Withdrawal Broadcasted!</h3>
            <p className="font-mono text-xs text-on-surface-variant mt-1">Tx: {txSuccess}</p>
            <p className="text-xs text-secondary mt-2 font-medium">Funds transferred to {activeWallet.slice(0, 6)}...{activeWallet.slice(-4)}</p>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
                Recipient Owner Wallet
              </label>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3.5 py-2.5 font-mono text-xs text-on-surface flex items-center justify-between">
                <span>{activeWallet}</span>
                <ShieldCheck className="h-4 w-4 text-secondary" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Withdrawal Amount (USDC)
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(maxAmount.toFixed(2))}
                  className="text-xs font-semibold text-primary hover:underline font-mono"
                >
                  Max (${maxAmount.toFixed(2)})
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-on-surface-variant">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="5"
                  max={maxAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest pl-8 pr-16 py-3 font-mono text-xl font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0.00"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-primary">
                  USDC
                </span>
              </div>

              <div className="flex items-center justify-between mt-2 text-[11px] text-on-surface-variant">
                <span>Minimum withdrawal: $5.00 USDC</span>
                <span>Network fee: $0.00 (Testnet / Zero Fee)</span>
              </div>
            </div>

            {numAmount > maxAmount && (
              <div className="rounded-lg bg-error/10 border border-error/30 p-2.5 flex items-center gap-2 text-xs text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Amount exceeds available withdrawable balance.</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || loading}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-on-primary transition ${
                  isValid && !loading
                    ? 'bg-primary hover:bg-[#33f3ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : 'bg-surface-container-low text-on-surface-variant cursor-not-allowed opacity-50'
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                Confirm Withdrawal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
