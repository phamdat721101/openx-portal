'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { ShieldCheck, LogIn, LogOut, Wallet } from 'lucide-react';
import Link from 'next/link';

export function HeaderWallet() {
  const { authenticated, activeWallet, login, logout } = usePortal();

  return (
    <div className="flex items-center gap-3">
      {authenticated ? (
        <div className="flex items-center gap-2">
          {/* Marketplace Cross-Link */}
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
          >
            Fleet Cockpit
          </Link>

          {/* Connected Wallet Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-agent-accent/30 bg-surface-container-high px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-secondary" />
            <span className="font-mono text-xs font-semibold text-on-surface">
              {activeWallet.slice(0, 6)}...{activeWallet.slice(-4)}
            </span>
          </div>

          {/* Disconnect Toggle */}
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-error transition"
            title="Disconnect Mock Wallet"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={login}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-[0_0_15px_rgba(0,240,255,0.25)] hover:bg-[#33f3ff] transition"
        >
          <LogIn className="h-4 w-4" />
          Connect Wallet
        </button>
      )}
    </div>
  );
}
