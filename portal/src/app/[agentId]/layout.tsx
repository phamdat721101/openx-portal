'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePortal } from '@/lib/portalContext';
import { TrainingStagePill } from '@/components/common/StatusBadge';
import { ArrowLeft, Wrench, Sliders, Moon, Bot, ShieldCheck } from 'lucide-react';

interface AgentLayoutProps {
  params: { agentId: string };
  children: React.ReactNode;
}

export default function AgentLayout({ params, children }: AgentLayoutProps) {
  const pathname = usePathname();
  const { getAgentById } = usePortal();
  const agent = getAgentById(params.agentId);

  const base = `/${params.agentId}`;

  const tabs = [
    { slug: 'skills', label: 'Skills & Tools', icon: Wrench },
    { slug: 'credit-model', label: 'Credit Model & Pricing', icon: Sliders },
    { slug: 'dream-cycle', label: 'Dream Cycle Bridge', icon: Moon },
    { slug: 'auditor', label: 'Wallet & Auditor', icon: ShieldCheck },
  ];

  if (!agent) {
    return (
      <div className="py-16 text-center space-y-4">
        <h2 className="font-headline text-2xl font-bold text-on-surface">Agent Not Found</h2>
        <p className="text-xs text-on-surface-variant">The requested agent ID does not belong to your connected wallet.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Agent Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Agent Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Agent Studio
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
              {agent.display_name}
            </h1>
            <TrainingStagePill stage={agent.training_stage} />
          </div>

          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
            {agent.description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px] text-on-surface-variant bg-surface-container-high px-3 py-1.5 rounded-xl border border-outline-variant/30">
          <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
          <span>UUID: {agent.id.slice(0, 8)}...</span>
        </div>
      </div>

      {/* 4-Tab Navigation Strip (Sticky, Operator Density) */}
      <nav
        className="sticky top-16 z-30 flex gap-2 overflow-x-auto border-b border-outline-variant/40 bg-background/95 pb-px backdrop-blur scrollbar-none"
        aria-label="Agent Portal Tabs"
      >
        {tabs.map((tab) => {
          const href = `${base}/${tab.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.slug}
              href={href}
              className={`flex items-center gap-2 shrink-0 border-b-2 px-4 py-3 text-xs font-headline font-bold transition-all duration-150 ${
                active
                  ? 'border-primary text-primary bg-primary/5 shadow-[inset_0_-2px_0_#00f0ff]'
                  : 'border-transparent text-on-surface-variant hover:border-outline-variant/60 hover:text-on-surface hover:bg-surface-container-low/50'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-on-surface-variant'}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Tab Content Page */}
      <div className="pt-2 animate-in fade-in duration-200">{children}</div>
    </div>
  );
}
