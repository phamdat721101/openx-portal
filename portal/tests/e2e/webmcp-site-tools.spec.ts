import { expect, test } from '@playwright/test';

test('registers global namespaced Site Tools and refreshes Portal state after a write', async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown>; annotations?: Record<string, unknown>; execute: (input: Record<string, unknown>) => Promise<unknown> }> = [];
    (window as Window & { __openxTools?: typeof tools }).__openxTools = tools;
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool: (tool: (typeof tools)[number]) => tools.push(tool) },
    });
  });

  let refreshEvents = 0;
  await page.route('**/v1/webmcp/agents/agent-123/skills/skill-123/status', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, skill: { id: 'skill-123', status: 'active' } }) }));

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => (window as Window & { __openxTools?: unknown[] }).__openxTools?.length || 0)).toBe(12);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.webmcp)).toBe('ready');
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="status"]')?.textContent)).toBe('Site Tools available (12/12)');
  await page.evaluate(() => window.addEventListener('openx:refresh-live-data', () => { (window as Window & { __openxRefreshEvents?: number }).__openxRefreshEvents = ((window as Window & { __openxRefreshEvents?: number }).__openxRefreshEvents || 0) + 1; }));

  const tools = await page.evaluate(() => (window as Window & { __openxTools?: Array<{ name: string; inputSchema: Record<string, unknown>; description: string; annotations?: { readOnlyHint: boolean } }> }).__openxTools!.map(({ name, inputSchema, description, annotations }) => ({ name, inputSchema, description, annotations })));
  expect(tools.map((tool) => tool.name)).toEqual([
    'openx_list_public_agents', 'openx_register_agent', 'openx_get_agent_overview', 'openx_get_working_process',
    'openx_list_agent_skills', 'openx_get_wallet_summary', 'openx_get_dream_status', 'openx_get_auditor_summary',
    'openx_navigate_portal_section', 'openx_set_skill_status', 'openx_trigger_dream_cycle', 'openx_ask_auditor',
  ]);
  const skillTool = tools.find((tool) => tool.name === 'openx_set_skill_status')!;
  expect(skillTool.inputSchema).toMatchObject({ additionalProperties: false, required: ['agent_id', 'skill_id', 'status'] });
  expect(skillTool.description).toContain('writes');
  expect(skillTool.annotations).toEqual({ readOnlyHint: false });
  expect(tools.find((tool) => tool.name === 'openx_get_agent_overview')?.annotations).toEqual({ readOnlyHint: true });

  const result = await page.evaluate(async () => {
    const tool = (window as Window & { __openxTools?: Array<{ name: string; execute: (input: Record<string, unknown>) => Promise<unknown> }> }).__openxTools!.find((item) => item.name === 'openx_set_skill_status')!;
    return tool.execute({ agent_id: 'agent-123', skill_id: 'skill-123', status: 'active' });
  });
  expect(result).toMatchObject({ ok: true });
  await expect.poll(() => page.evaluate(() => (window as Window & { __openxRefreshEvents?: number }).__openxRefreshEvents || 0)).toBe(1);
});

test('keeps ordinary browsers functional when WebMCP is unavailable', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.webmcp)).toBe('unavailable');
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="status"]')?.textContent)).toBe('Site Tools unavailable in this browser');
  await expect(page.getByRole('link', { name: 'Studio Hub' })).toBeVisible();
});

test('reports a degraded Site Tools state when a registration is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: (tool: { name: string }) => tool.name === 'openx_ask_auditor'
          ? Promise.reject(new Error('host rejected tool'))
          : undefined,
      },
    });
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.webmcp)).toBe('degraded');
  await expect.poll(() => page.evaluate(() => document.querySelector('[role="status"]')?.textContent)).toBe('Site Tools degraded (11/12)');
  await expect(page.getByRole('link', { name: 'Studio Hub' })).toBeVisible();
});
