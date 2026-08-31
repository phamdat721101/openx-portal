import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('renders the cleaned portal shell without mock wallet identity', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Studio Hub' })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Docs' })).toBeVisible();
  await expect(page.getByText('XRPL Testnet · x402 Micropayment Rail Active')).toHaveCount(0);
  await expect(page.getByText('Arbitrage Flow Sentinel')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'HyperMove', exact: true })).toHaveAttribute('href', 'https://www.hypermove.xyz/');
  await expect(page.getByText('Google ADK')).toHaveCount(0);
  console.log('seam:portal-header-brand-no-mock-wallet');
});

test('renders public detailed telemetry without a wallet session', async ({ page }) => {
  await page.route('**/v1/**', async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, agents: [], traces: [], summaries: [] }) }));
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
  await expect(page.getByRole('region', { name: 'Token consumption and unit economics' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Public aggregate telemetry for the current billing month.')).toBeVisible();
  await expect(page.getByText('1,800')).toBeVisible();
  await expect(page.getByText('0.0900 USDC', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('nim-cache')).toBeVisible();
  console.log('seam:portal-telemetry-public-state');
});

test('projects reconciled Dream and registration states in Fleet Evidence', async ({ page }) => {
  await page.route('**/health', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('**/v1/**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, agents: [], traces: [], summaries: [] }) }));
  await page.route('**/v1/agents/overview', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, summary: { registered: 2, online: 1, linked: 1, auditor_ready: 2 }, agents: [
    { agent: { agent_id: 'linked-agent', slug: 'linked-agent', display_name: 'Linked Agent', description: 'Verified link.', model: 'test', capabilities: [], host_type: 'custom', owner_address: null, wallet_address: null, owner_verified: false, registration_source: 'explicit', state: 'online', registered_at: '2026-08-31T00:00:00.000Z', last_seen_at: '2026-08-31T00:00:00.000Z' }, connection: { state: 'online', last_seen_at: '2026-08-31T00:00:00.000Z' }, dream: { linked: true, hypermove_agent_id: 'hm-linked' }, activity: { current_task: null, latest_task: null }, audit: { ready: true, job_count: 1 } },
    { agent: { agent_id: 'registered-agent', slug: 'registered-agent', display_name: 'Registered Agent', description: 'Awaiting heartbeat.', model: 'test', capabilities: [], host_type: 'custom', owner_address: null, wallet_address: null, owner_verified: false, registration_source: 'explicit', state: 'registered', registered_at: '2026-08-31T00:00:00.000Z', last_seen_at: null }, connection: { state: 'registered', last_seen_at: null }, dream: { linked: false, hypermove_agent_id: null }, activity: { current_task: null, latest_task: null }, audit: { ready: true, job_count: 1 } },
  ] }) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fleet Evidence' })).toBeVisible();
  await expect(page.getByText('1 Dream linked')).toBeVisible();
  await expect(page.getByText('REM Active')).toBeVisible();
  await expect(page.getByText('Registered — awaiting first heartbeat.')).toBeVisible();
  await expect(page.getByText('Dream not configured')).toBeVisible();
  console.log('seam:fleet-overview-reconciliation');
});

test('allows an unauthenticated visitor to register and receive a one-time agent key', async ({ page }) => {
  await page.route('**/v1/**', async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, agents: [], traces: [], summaries: [] }) }));
  await page.route('**/health', async (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.route('**/v1/agent/register', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      status: 'registered',
      agent: {
        agent_id: 'f8b2d1c9-724e-4f16-9562-581335b2df01', slug: 'public-agent', display_name: 'Public Agent', description: null,
        model: 'qwen2.5-omni', capabilities: [], host_type: 'custom', owner_address: null, wallet_address: null,
        owner_verified: false, registration_source: 'explicit', state: 'registered', registered_at: '2026-08-29T00:00:00.000Z', last_seen_at: null,
      },
      credential: { agent_key: 'oxag_public_one_time_key', shown_once: true },
    }),
  }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Connect Agent' }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Connect Agent' }).first().click();
  await expect(page.getByText('Public self-service registration issues a one-time agent key.')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Register and issue key' }).click();
  await expect(page.getByText('OPENX_AGENT_ID=f8b2d1c9-724e-4f16-9562-581335b2df01')).toBeVisible();
  await expect(page.getByText('OPENX_AGENT_KEY=oxag_public_one_time_key')).toBeVisible();
  await expect(page.getByText('Agent setup prompt')).toBeVisible();
  const setupPrompt = await page.locator('pre').filter({ hasText: 'Connect this agent to the OpenX Portal' }).textContent();
  expect(setupPrompt).toContain('Agent ID: f8b2d1c9-724e-4f16-9562-581335b2df01');
  expect(setupPrompt).not.toContain('oxag_public_one_time_key');
  await expect(page.getByRole('button', { name: 'Copy one-time key' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy setup prompt' })).toBeVisible();
  console.log('seam:portal-public-registration');
});

test('offers a reusable secret-free agent connection prompt in Docs', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'Agent Connection Prompt' })).toBeVisible();
  const prompt = await page.locator('pre').filter({ hasText: 'Connect this agent to the OpenX Portal' }).textContent();
  expect(prompt).toContain('Gateway URL: https://');
  expect(prompt).toContain('Deployed gateway');
  expect(prompt).toContain('OPENX_AGENT_KEY');
  expect(prompt).toContain('Never send raw prompts');
  expect(prompt).not.toContain('oxag_');
  await expect(page.getByRole('button', { name: 'Copy prompt' }).first()).toBeVisible();
  console.log('seam:portal-agent-connection-prompt');
});
