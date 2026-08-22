import './globals.css';
import type { Metadata } from 'next';
import { PortalProvider } from '@/lib/portalContext';
import { Toast } from '@/components/common/Toast';
import { OpenXLogo } from '@/components/common/OpenXLogo';
import { HeaderWallet } from './HeaderWallet';

export const metadata: Metadata = {
  title: 'OpenX Agent Portal — Fleet & Monetization Cockpit',
  description: 'High-density operator management console for OpenX autonomous AI agents, wallet earnings, skills lifecycle, credit models, and Dream Cycle learning.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-on-surface flex flex-col min-h-screen">
        <PortalProvider>
          {/* Top Global Agent Portal Nav Header (Violet Agent-Accent Chrome) */}
          <header className="sticky top-0 z-40 border-b border-agent-accent/25 bg-[#131314]/90 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              {/* Logo & Sub-project Identifier */}
              <OpenXLogo
                subText="Autonomous Agent Fleet Cockpit"
                className="shrink-0"
              />

              {/* Center status bar */}
              <div className="hidden md:flex items-center gap-2 rounded-full border border-agent-accent/25 bg-agent-accent/5 px-3 py-1 text-xs text-[#d1bcff] font-mono">
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                <span>OpenX L2 zkEVM · Karma Gasless Active</span>
              </div>

              {/* Right Wallet & Account Strip */}
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
          <footer className="border-t border-outline-variant/30 bg-surface-container-low py-6 text-center text-xs text-on-surface-variant">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-headline font-semibold text-primary">OpenX Infrastructure System</span>
              <span>@openx/agent-portal · Version 1.0.0 (Operator Register)</span>
              <div className="flex gap-4 font-mono text-[11px]">
                <a href="#" className="hover:text-primary">API Docs</a>
                <a href="#" className="hover:text-primary">HyperMove MCP</a>
                <a href="#" className="hover:text-primary">Status L2</a>
              </div>
            </div>
          </footer>
        </PortalProvider>
      </body>
    </html>
  );
}
