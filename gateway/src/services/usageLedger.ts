import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gatewayDatabase } from '../db/database.js';
import { AgentUsageDetail, AgentUsageEventPayload, AgentUsageSummary, UsageTokenKind } from '../types/agentIngestion.js';

type MicroUsdc = number;

interface ModelRate {
  input_micro_per_million: MicroUsdc;
  output_micro_per_million: MicroUsdc;
  cached_input_micro_per_million: MicroUsdc;
  reasoning_micro_per_million: MicroUsdc;
}

interface PlanRate {
  id: string;
  monthly_fee_micro_usdc: MicroUsdc;
  included_allowance_micro_usdc: MicroUsdc;
  overage_multiplier_bps: number;
  platform_fee_bps: number;
}

export interface UsageBillingCatalog {
  version: string;
  model_aliases: Record<string, string>;
  model_rates: Record<string, ModelRate>;
  tool_rates_micro_usdc: Record<string, MicroUsdc>;
  plans: Record<string, PlanRate>;
}

interface StoredUsageEvent extends AgentUsageEventPayload { received_at: string; }

interface InternalUsageSummary extends AgentUsageSummary {
  cached_input_tokens: number;
  reasoning_tokens: number;
  overage_micro_usdc: number;
  gross_billed_micro_usdc: number;
  provider_cost_micro_usdc: number;
  nim_avoided_cost_micro_usdc: number;
  platform_fee_micro_usdc: number;
  net_earnings_micro_usdc: number;
}

interface SavingAggregate {
  baseline_tokens: number;
  actual_tokens: number;
  avoided_cost_micro_usdc: number;
}

const MILLION = 1_000_000;
const DEFAULT_CATALOG: UsageBillingCatalog = {
  version: '2026-08-13-gemini-v1',
  model_aliases: { 'gemini-3.5': 'gemini-3.5-flash' },
  model_rates: {
    'gemini-3.5-flash': {
      input_micro_per_million: 1_500_000,
      output_micro_per_million: 9_000_000,
      cached_input_micro_per_million: 150_000,
      reasoning_micro_per_million: 9_000_000,
    },
  },
  tool_rates_micro_usdc: { 'google-search': 14_000, 'google-workspace-cli.sheets.read': 0, 'code-execution': 0 },
  plans: {
    starter: { id: 'starter', monthly_fee_micro_usdc: 0, included_allowance_micro_usdc: 5_000_000, overage_multiplier_bps: 12_500, platform_fee_bps: 1_500 },
    pro: { id: 'pro', monthly_fee_micro_usdc: 29_000_000, included_allowance_micro_usdc: 40_000_000, overage_multiplier_bps: 12_000, platform_fee_bps: 1_500 },
    enterprise: { id: 'enterprise', monthly_fee_micro_usdc: 0, included_allowance_micro_usdc: 0, overage_multiplier_bps: 11_000, platform_fee_bps: 1_000 },
  },
};

const monthFor = (iso: string) => iso.slice(0, 7);
const microForTokens = (tokens: number, rate: number) => Math.round((tokens * rate) / MILLION);
const defaultSummary = (agentId: string, month: string, plan: PlanRate, catalog: UsageBillingCatalog): InternalUsageSummary => ({
  agent_id: agentId, billing_month: month, plan_id: plan.id, catalog_version: catalog.version,
  usage_events: 0, input_tokens: 0, output_tokens: 0, tool_calls: 0, skill_calls: 0,
  cached_input_tokens: 0, reasoning_tokens: 0,
  included_allowance_micro_usdc: plan.included_allowance_micro_usdc, included_consumed_micro_usdc: 0,
  overage_micro_usdc: 0, gross_billed_micro_usdc: plan.monthly_fee_micro_usdc,
  provider_cost_micro_usdc: 0, nim_tokens_saved: 0, nim_avoided_cost_micro_usdc: 0,
  platform_fee_micro_usdc: 0, net_earnings_micro_usdc: 0, unpriced_items: 0,
});

export class UsageLedger {
  private events: StoredUsageEvent[] = [];
  private readonly path?: string;
  private readonly catalogPath?: string;
  private catalog: UsageBillingCatalog;
  private readonly production: boolean;

  constructor(options: { path?: string; catalogPath?: string; production?: boolean } = {}) {
    this.path = options.path || process.env.OPENX_USAGE_LEDGER_PATH;
    this.catalogPath = options.catalogPath || process.env.OPENX_BILLING_CATALOG_PATH;
    this.production = options.production ?? process.env.OPENX_AGENT_REGISTRATION_MODE === 'production';
    this.catalog = this.loadCatalog();
    this.load();
  }

  public record(event: AgentUsageEventPayload): { created: boolean; event: StoredUsageEvent } {
    this.assertAvailable();
    const existing = this.events.find((item) => item.event_id === event.event_id);
    if (existing) return { created: false, event: existing };
    const stored = { ...event, received_at: new Date().toISOString() };
    this.events.push(stored);
    this.persist();
    return { created: true, event: stored };
  }

  public summary(agentId: string, month = monthFor(new Date().toISOString())): AgentUsageSummary {
    this.assertAvailable();
    return this.publicSummary(this.calculate(agentId, month).summary);
  }

  public detail(agentId: string, month = monthFor(new Date().toISOString())): AgentUsageDetail {
    this.assertAvailable();
    const { summary, savings } = this.calculate(agentId, month);
    const operational = this.publicSummary(summary);
    const totalTokens = summary.input_tokens + summary.output_tokens + summary.cached_input_tokens + summary.reasoning_tokens;
    const inputEligibleForCache = summary.input_tokens + summary.cached_input_tokens;
    return {
      ...operational,
      tokens: {
        input_raw: summary.input_tokens,
        output_generated: summary.output_tokens,
        cached_prompt: summary.cached_input_tokens,
        reasoning_internal: summary.reasoning_tokens,
        total_effective: totalTokens,
        cache_hit_rate_pct: inputEligibleForCache === 0 ? 0 : Number(((summary.cached_input_tokens / inputEligibleForCache) * 100).toFixed(2)),
      },
      economics: {
        gross_model_cost_micro_usdc: summary.provider_cost_micro_usdc + summary.nim_avoided_cost_micro_usdc,
        actual_provider_cost_micro_usdc: summary.provider_cost_micro_usdc,
        revenue_micro_usdc: summary.gross_billed_micro_usdc,
        net_earnings_micro_usdc: summary.net_earnings_micro_usdc,
        gross_margin_pct: summary.gross_billed_micro_usdc === 0 ? null : Number(((summary.net_earnings_micro_usdc / summary.gross_billed_micro_usdc) * 100).toFixed(2)),
      },
      nim_savings: {
        total_tokens_saved: summary.nim_tokens_saved,
        total_avoided_cost_micro_usdc: summary.nim_avoided_cost_micro_usdc,
        primitives: Array.from(savings.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({
          name,
          tokens_saved: Math.max(0, value.baseline_tokens - value.actual_tokens),
          avoided_cost_micro_usdc: value.avoided_cost_micro_usdc,
          percentage_reduction: value.baseline_tokens === 0 ? 0 : Number((Math.max(0, (value.baseline_tokens - value.actual_tokens) / value.baseline_tokens * 100)).toFixed(2)),
        })),
      },
    };
  }

  private calculate(agentId: string, month: string): { summary: InternalUsageSummary; savings: Map<string, SavingAggregate> } {
    const events = this.events.filter((event) => event.agent_id === agentId && monthFor(event.occurred_at) === month)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const plan = this.planFor(events.at(-1)?.plan_id);
    const summary = defaultSummary(agentId, month, plan, this.catalog);
    const savings = new Map<string, SavingAggregate>();
    let allowanceRemaining = plan.included_allowance_micro_usdc;
    for (const event of events) this.applyEvent(summary, event, allowanceRemaining, (next) => { allowanceRemaining = next; }, savings);
    summary.platform_fee_micro_usdc = Math.round((summary.gross_billed_micro_usdc * plan.platform_fee_bps) / 10_000);
    summary.net_earnings_micro_usdc = summary.gross_billed_micro_usdc - summary.provider_cost_micro_usdc - summary.platform_fee_micro_usdc;
    return { summary, savings };
  }

  private publicSummary(summary: InternalUsageSummary): AgentUsageSummary {
    const {
      cached_input_tokens: _cachedInput,
      reasoning_tokens: _reasoning,
      overage_micro_usdc: _overage,
      gross_billed_micro_usdc: _grossBilled,
      provider_cost_micro_usdc: _providerCost,
      nim_avoided_cost_micro_usdc: _nimAvoidedCost,
      platform_fee_micro_usdc: _platformFee,
      net_earnings_micro_usdc: _netEarnings,
      ...operational
    } = summary;
    return operational;
  }

  public portfolio(month = monthFor(new Date().toISOString())): AgentUsageSummary[] {
    this.assertAvailable();
    return Array.from(new Set(this.events.filter((event) => monthFor(event.occurred_at) === month).map((event) => event.agent_id)))
      .map((agentId) => this.summary(agentId, month));
  }

  public clear(): void { this.events = []; this.persist(); }

  private applyEvent(summary: InternalUsageSummary, event: StoredUsageEvent, allowanceRemaining: number, setAllowance: (value: number) => void, savings: Map<string, SavingAggregate>): void {
    summary.usage_events += 1;
    let eventCost = 0;
    for (const usage of event.model_usage || []) {
      const model = this.catalog.model_aliases[usage.model] || usage.model;
      const rate = this.catalog.model_rates[model];
      const tokenEntries: Array<[UsageTokenKind, number]> = [['input', usage.input_tokens || 0], ['output', usage.output_tokens || 0], ['cached_input', usage.cached_input_tokens || 0], ['reasoning', usage.reasoning_tokens || 0]];
      summary.input_tokens += usage.input_tokens || 0;
      summary.output_tokens += usage.output_tokens || 0;
      summary.cached_input_tokens += usage.cached_input_tokens || 0;
      summary.reasoning_tokens += usage.reasoning_tokens || 0;
      if (!rate) { summary.unpriced_items += tokenEntries.filter(([, tokens]) => tokens > 0).length; continue; }
      for (const [kind, tokens] of tokenEntries) eventCost += microForTokens(tokens, rate[`${kind}_micro_per_million`]);
    }
    for (const call of event.tool_calls || []) {
      summary.tool_calls += call.calls;
      const unitRate = this.catalog.tool_rates_micro_usdc[call.tool_id];
      if (unitRate === undefined) summary.unpriced_items += call.calls;
      else eventCost += unitRate * (call.billable_units ?? call.calls);
    }
    for (const call of event.skill_invocations || []) summary.skill_calls += call.calls;
    summary.provider_cost_micro_usdc += eventCost;
    const included = Math.min(allowanceRemaining, eventCost);
    summary.included_consumed_micro_usdc += included;
    setAllowance(allowanceRemaining - included);
    const overageBase = eventCost - included;
    summary.overage_micro_usdc += Math.round((overageBase * this.planFor(event.plan_id).overage_multiplier_bps) / 10_000);
    summary.gross_billed_micro_usdc = this.planFor(event.plan_id).monthly_fee_micro_usdc + summary.overage_micro_usdc;
    for (const saving of event.nim_savings || []) {
      const saved = Math.max(0, saving.baseline_tokens - saving.actual_tokens);
      const aggregate = savings.get(saving.primitive) || { baseline_tokens: 0, actual_tokens: 0, avoided_cost_micro_usdc: 0 };
      aggregate.baseline_tokens += saving.baseline_tokens;
      aggregate.actual_tokens += saving.actual_tokens;
      const rate = this.catalog.model_rates[this.catalog.model_aliases[saving.model] || saving.model];
      summary.nim_tokens_saved += saved;
      if (!rate) { if (saved) summary.unpriced_items += 1; savings.set(saving.primitive, aggregate); continue; }
      const avoided = microForTokens(saved, rate[`${saving.token_kind}_micro_per_million`]);
      summary.nim_avoided_cost_micro_usdc += avoided;
      aggregate.avoided_cost_micro_usdc += avoided;
      savings.set(saving.primitive, aggregate);
    }
  }

  private planFor(planId?: string): PlanRate { return this.catalog.plans[planId || 'starter'] || this.catalog.plans.starter; }
  private assertAvailable(): void { if (this.production && (!this.path || !this.catalogPath)) throw new Error('usage_ledger_not_configured'); }
  private loadCatalog(): UsageBillingCatalog {
    if (!this.catalogPath) return DEFAULT_CATALOG;
    if (!existsSync(this.catalogPath)) { if (this.production) return DEFAULT_CATALOG; return DEFAULT_CATALOG; }
    return JSON.parse(readFileSync(this.catalogPath, 'utf8')) as UsageBillingCatalog;
  }
  private load(): void { if (!this.path) { this.events = gatewayDatabase.read<StoredUsageEvent[]>('usage_ledger', []); return; } if (!existsSync(this.path)) return; this.events = JSON.parse(readFileSync(this.path, 'utf8')) as StoredUsageEvent[]; }
  private persist(): void {
    if (!this.path) { gatewayDatabase.write('usage_ledger', this.events); return; }
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.events));
    renameSync(temporary, this.path);
  }
}

export const usageLedger = new UsageLedger();
