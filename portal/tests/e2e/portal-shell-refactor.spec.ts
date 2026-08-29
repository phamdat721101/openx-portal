import { expect, test } from '@playwright/test';

test('renders the cleaned portal shell without mock wallet identity', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Studio Hub' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(page.getByText('XRPL Testnet · x402 Micropayment Rail Active')).toHaveCount(0);
  await expect(page.getByText('Arbitrage Flow Sentinel')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'HyperMove' })).toHaveAttribute('href', 'https://www.hypermove.xyz/');
  await expect(page.getByText('Google ADK')).toHaveCount(0);
  console.log('seam:portal-header-brand-no-mock-wallet');
});

test('renders public detailed telemetry without a wallet session', async ({ page }) => {
  await page.route('**/api/agents/**/usage-detail', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, detail: {
      agent_id: 'f8b2d1c9-724e-4f16-9562-581335b2df01', billing_month: '2026-08', plan_id: 'pro', catalog_version: 'v1', usage_events: 1,
      input_tokens: 1_000, output_tokens: 500, tool_calls: 2, skill_calls: 1, included_allowance_micro_usdc: 0, included_consumed_micro_usdc: 0, nim_tokens_saved: 600, unpriced_items: 0,
      tokens: { input_raw: 1_000, output_generated: 500, cached_prompt: 250, reasoning_internal: 50, total_effective: 1_800, cache_hit_rate_pct: 20 },
      economics: { gross_model_cost_micro_usdc: 120_000, actual_provider_cost_micro_usdc: 90_000, revenue_micro_usdc: 180_000, net_earnings_micro_usdc: 90_000, gross_margin_pct: 50 },
      nim_savings: { total_tokens_saved: 600, total_avoided_cost_micro_usdc: 30_000, primitives: [{ name: 'nim-cache', tokens_saved: 600, avoided_cost_micro_usdc: 30_000, percentage_reduction: 75 }] },
    } }),
  }));
  await page.goto('/f8b2d1c9-724e-4f16-9562-581335b2df01/credit-model');
  await expect(page.getByRole('region', { name: 'Token consumption and unit economics' })).toBeVisible();
  await expect(page.getByText('Public aggregate telemetry for the current billing month.')).toBeVisible();
  await expect(page.getByText('1,800')).toBeVisible();
  await expect(page.getByText('0.0900 USDC', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('nim-cache')).toBeVisible();
  console.log('seam:portal-telemetry-public-state');
});
