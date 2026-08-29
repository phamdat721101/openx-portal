'use client';

import React from 'react';
import { Cpu, Database, ShieldCheck, TrendingDown } from 'lucide-react';
import { fetchUsageDetail, UsageDetail } from '@/lib/api/agentGateway';

const usdc = (micro: number) => `${(micro / 1_000_000).toFixed(4)} USDC`;
const tokens = (value: number) => value.toLocaleString();

export function TokenConsumptionCard({ agentId }: { agentId: string }) {
  const [detail, setDetail] = React.useState<UsageDetail | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'empty' | 'unavailable'>('loading');

  React.useEffect(() => {
    let active = true;
    async function load() {
      const result = await fetchUsageDetail(agentId);
      if (!active) return;
      setDetail(result.detail);
      setState(result.detail ? result.detail.usage_events === 0 ? 'empty' : 'ready' : 'unavailable');
    }
    void load();
    return () => { active = false; };
  }, [agentId]);

  return <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6" aria-label="Token consumption and unit economics">
    <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-4"><div className="rounded-xl border border-primary/30 bg-primary/15 p-2 text-primary"><Cpu className="h-5 w-5" /></div><div><h3 className="font-headline text-base font-bold text-on-surface">Token Consumption & Unit Economics</h3><p className="text-xs text-on-surface-variant">Public aggregate telemetry for the current billing month.</p></div></div>
    {state === 'loading' && <div className="mt-5 h-32 animate-pulse rounded-xl bg-surface-container-high/60" />}
    {state === 'unavailable' && <div className="mt-5 rounded-xl border border-dashed border-outline-variant/40 p-5 text-sm text-on-surface-variant">Usage telemetry is temporarily unavailable. Confirm the local Gateway is running, then reload this page.</div>}
    {state === 'empty' && <div className="mt-5 rounded-xl border border-dashed border-outline-variant/40 p-5 text-sm text-on-surface-variant">No usage has been recorded for this agent in the current billing month.</div>}
    {state === 'ready' && detail && <div className="mt-5 space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Effective tokens', tokens(detail.tokens.total_effective)], ['Cache hit rate', `${detail.tokens.cache_hit_rate_pct}%`], ['Actual provider cost', usdc(detail.economics.actual_provider_cost_micro_usdc)], ['Gross margin', detail.economics.gross_margin_pct === null ? 'Not available' : `${detail.economics.gross_margin_pct}%`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p><p className="mt-1 font-mono text-lg font-bold text-on-surface">{value}</p></div>)}</div>
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">{[['Input', detail.tokens.input_raw], ['Output', detail.tokens.output_generated], ['Cached', detail.tokens.cached_prompt], ['Reasoning', detail.tokens.reasoning_internal]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-outline-variant/20 p-3"><p className="text-on-surface-variant">{label}</p><p className="mt-1 font-mono font-bold text-on-surface">{tokens(Number(value))}</p></div>)}</div>
      <div className="rounded-xl border border-secondary/25 bg-secondary/5 p-4"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-secondary" /><h4 className="font-headline text-sm font-bold text-on-surface">nim-skill Cost Reduction</h4></div><p className="mt-1 text-xs text-on-surface-variant">{tokens(detail.nim_savings.total_tokens_saved)} tokens avoided · {usdc(detail.nim_savings.total_avoided_cost_micro_usdc)} estimated avoided cost</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{detail.nim_savings.primitives.map((saving) => <div key={saving.name} className="rounded-lg border border-outline-variant/25 bg-surface-container-high/60 p-3 text-xs"><div className="flex justify-between gap-2"><code className="font-bold text-primary">{saving.name}</code><span className="text-secondary">{saving.percentage_reduction}% reduced</span></div><p className="mt-1 text-on-surface-variant">{tokens(saving.tokens_saved)} tokens · {usdc(saving.avoided_cost_micro_usdc)}</p></div>)}</div></div>
      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant"><Database className="h-3.5 w-3.5" />Gross model estimate {usdc(detail.economics.gross_model_cost_micro_usdc)} · Revenue {usdc(detail.economics.revenue_micro_usdc)} · Net earnings {usdc(detail.economics.net_earnings_micro_usdc)}<ShieldCheck className="ml-auto h-3.5 w-3.5 text-secondary" />No prompts or credentials are exposed.</div>
    </div>}
  </section>;
}
