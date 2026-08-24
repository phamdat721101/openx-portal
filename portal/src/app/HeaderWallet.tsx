'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { ShieldCheck, LogIn, LogOut, Wallet, Sun, Moon } from 'lucide-react';
import Link from 'next/link';

export function HeaderWallet() {
  const { authenticated, activeWallet, login, logout, theme, toggleTheme } = usePortal();

  return (
    <div className="flex items-center gap-3">
      {/* Dark / Light Mode Switcher */}
      <button
        onClick={toggleTheme}
        className="rounded-xl border border-outline-variant/30 bg-surface-container-high/60 p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition shadow-sm"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle Dark/Light Theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 text-primary transition-transform hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 text-agent-accent transition-transform hover:-rotate-12" />
        )}
      </button>

      {authenticated ? (
        <div className="flex items-center gap-2">
          {/* Marketplace Cross-Link */}
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
          >
            Agent Studio
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
