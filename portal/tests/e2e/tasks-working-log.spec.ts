import { expect, test } from '@playwright/test';

const agentId = '8c51f7d2-f55a-4a39-be6f-ced8045c6e6c';
const agent = { agent_id: agentId, slug: 'working-log-agent', display_name: 'Working Log Agent', description: 'Connected test agent.', model: 'test-model', capabilities: [], host_type: 'custom', owner_address: null, wallet_address: null, owner_verified: false, registration_source: 'explicit', state: 'online', registered_at: '2026-09-04T00:00:00.000Z', last_seen_at: '2026-09-04T00:00:00.000Z' };

test('renders a connected-agent working log in the selected task', async ({ page }) => {
  const task = { task_id: 'task-working-log', title: 'Collect XRPL sources', category: 'research', model: 'test-model', state: 'running', input_tokens: 42, latency_ms: 12, deliverable_markdown: null, deliverable_sha256: null, created_at: '2026-09-04T00:00:00.000Z', completed_at: null };
  await page.route('**/v1/agents/overview', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, summary: { registered: 1, online: 1, linked: 0, auditor_ready: 0 }, agents: [{ agent, connection: { state: 'online', last_seen_at: agent.last_seen_at }, dream: { linked: false, hypermove_agent_id: null }, activity: { current_task: null, latest_task: null }, audit: { ready: false, job_count: 0 } }] }) }));
  await page.route(`**/v1/agents/${agentId}`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, agent }) }));
  await page.route(`**/v1/agents/${agentId}/tasks`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, tasks: [task] }) }));
  await page.route(`**/v1/agents/${agentId}/tasks/task-working-log`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, task, working_log: [{ event_id: '550e8400-e29b-41d4-a716-446655440000', sequence: 1, phase: 'collecting_sources', progress_pct: 25, kind: 'phase', markdown: 'Collected safe XRPL sources.', created_at: '2026-09-04T00:00:00.000Z' }] }) }));
  await page.goto(`/${agentId}/tasks`);
  await expect(page.getByRole('heading', { name: 'Tasks & Deliverables' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Collect XRPL sources' })).toBeVisible();
  await expect(page.getByText('Collected safe XRPL sources.')).toBeVisible();
  console.log('seam:tasks-working-log-e2e');
});
