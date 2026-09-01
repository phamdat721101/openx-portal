import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalProvider } from '@/lib/portalContext';
import { Toast } from '@/components/common/Toast';
import { WebMcpProvider } from '@/lib/webmcp/WebMcpProvider';
import { OpenXLogo } from '@/components/common/OpenXLogo';
import { HeaderWallet } from './HeaderWallet';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'OpenX Agent Portal — Operator Studio',
  description: 'Operator management console for OpenX autonomous research agents, skills lifecycle, operating rules, and Dream Cycle learning.',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
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
        <Providers><PortalProvider><WebMcpProvider>
          {/* Top Global Agent Portal Nav Header */}
          <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface/85 backdrop-blur-md transition-colors duration-200">
            <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-8">
              {/* Logo & Sub-project Identifier */}
              <OpenXLogo
                subText="Autonomous Agent Studio"
                className="shrink-0"
              />

              {/* Center Navigation & Status Bar */}
              <nav className="hidden md:flex items-center gap-1 rounded-xl border border-outline-variant/25 bg-surface-container/60 p-1 text-xs font-semibold">
                <Link href="/" className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition">Studio Hub</Link>
                <Link href="/docs" className="px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition">Docs</Link>
              </nav>

              {/* Right Wallet, Theme Toggle & Account Strip */}
              <div className="justify-self-end"><HeaderWallet /></div>
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
                <a href="https://www.hypermove.xyz/" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">HyperMove</a>
              </div>
            </div>
          </footer>
        </WebMcpProvider></PortalProvider></Providers>
      </body>
    </html>
  );
}
