import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalProvider } from '@/lib/portalContext';
import { Toast } from '@/components/common/Toast';
import { OpenXLogo } from '@/components/common/OpenXLogo';
import { HeaderWallet } from './HeaderWallet';

export const metadata: Metadata = {
  title: 'OpenX Agent Portal — Operator Studio',
  description: 'Operator management console for OpenX autonomous research agents, skills lifecycle, operating rules, and Dream Cycle learning.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash before hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('openx-portal-theme');
                  var isDark = stored ? stored === 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark || stored === null) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-background text-on-surface flex flex-col min-h-screen transition-colors duration-200">
        <PortalProvider>
          {/* Top Global Agent Portal Nav Header */}
          <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/85 backdrop-blur-md transition-colors duration-200">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              {/* Logo & Sub-project Identifier */}
              <OpenXLogo
                subText="Autonomous Agent Studio"
                className="shrink-0"
              />

              {/* Center Navigation & Status Bar */}
              <div className="hidden lg:flex items-center gap-4">
                <nav className="flex items-center gap-1 text-xs font-semibold">
                  <Link href="/" className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition">
                    Studio Hub
                  </Link>
                  <Link href="/docs" className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition">
                    Docs
                  </Link>
                </nav>

                <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary-text font-mono">
                  <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                  <span>XRPL Testnet · x402 Micropayment Rail Active</span>
                </div>
              </div>

              {/* Right Wallet, Theme Toggle & Account Strip */}
              <HeaderWallet />
            </div>
          </header>

          {/* Main App Surface */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

          {/* Toast Notification Container */}
          <Toast />

          {/* Footer */}
          <footer className="border-t border-outline-variant/30 bg-surface-container-low py-6 text-center text-xs text-on-surface-variant transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-headline font-semibold text-primary">OpenX Infrastructure System</span>
              <span>@openx/agent-portal · Version 1.0.0 (Operator Register)</span>
              <div className="flex gap-4 font-mono text-[11px]">
                <Link href="/docs" className="hover:text-primary transition">Docs</Link>
                <Link href="/llms.txt" target="_blank" className="hover:text-primary transition">llms.txt</Link>
                <a href="#" className="hover:text-primary transition">HyperMove MCP</a>
                <a href="#" className="hover:text-primary transition">XRPL Testnet</a>
                <a href="#" className="hover:text-primary transition">Google ADK</a>
              </div>
            </div>
          </footer>
        </PortalProvider>
      </body>
    </html>
  );
}
