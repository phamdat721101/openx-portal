'use client';

import React, { useState } from 'react';
import { LedgerItem } from '@/lib/types';
import { ExternalLink, Filter, ArrowDownLeft, ArrowUpRight, Bot, Zap, Layers } from 'lucide-react';

interface LedgerTableProps {
  items: LedgerItem[];
}

export function LedgerTable({ items }: LedgerTableProps) {
  const [filter, setFilter] = useState<'all' | 'credit' | 'exact' | 'sub_agent'>('all');

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.method === filter;
  });

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'credit':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary border border-primary/25">
            <Layers className="h-3 w-3" /> Credit
          </span>
        );
      case 'exact':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-secondary border border-secondary/25">
            <Zap className="h-3 w-3" /> x402 Direct
          </span>
        );
      case 'sub_agent':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-agent-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-agent-accent border border-agent-accent/30">
            <Bot className="h-3 w-3" /> Sub-Agent
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
      {/* Table Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-outline-variant/30 bg-surface-container/40">
        <div>
          <h3 className="font-headline text-base font-bold text-on-surface">Revenue & Settlement Ledger</h3>
          <p className="text-xs text-on-surface-variant">Real-time cryptographic audit trail of buyer tool calls</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'credit', 'exact', 'sub_agent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                filter === t
                  ? 'bg-primary text-on-primary font-bold shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
              }`}
            >
              {t === 'all' ? 'All Rows' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-outline-variant/30 bg-surface-container-high/30 text-on-surface-variant uppercase tracking-wider font-mono text-[11px]">
              <th className="py-2.5 px-4 font-semibold">Timestamp</th>
              <th className="py-2.5 px-4 font-semibold">Method</th>
              <th className="py-2.5 px-4 font-semibold">Description</th>
              <th className="py-2.5 px-4 font-semibold">Caller / Target</th>
              <th className="py-2.5 px-4 font-semibold">Network</th>
              <th className="py-2.5 px-4 font-semibold text-right">Amount (USDC)</th>
              <th className="py-2.5 px-4 font-semibold text-center">Tx Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                  No transactions recorded for this filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isWithdrawal = item.amount_usdc < 0;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container/60 transition-colors font-mono"
                  >
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getMethodBadge(item.method)}
                    </td>
                    <td className="py-3 px-4 font-body text-on-surface text-xs max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                      {item.caller_address.slice(0, 6)}...{item.caller_address.slice(-4)}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap font-body text-[11px]">
                      {item.network}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap font-bold">
                      <span className={isWithdrawal ? 'text-error' : 'text-secondary'}>
                        {isWithdrawal ? '-' : '+'}${Math.abs(item.amount_usdc).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer">
                        {item.tx_hash}
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
