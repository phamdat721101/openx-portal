import { expect, test } from '@playwright/test';

const agentId = '8c51f7d2-f55a-4a39-be6f-ced8045c6e6c';

test('renders an empty but linked Dream agent without client errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`/${agentId}/dream-cycle`);

  await expect(page.getByRole('heading', { name: 'Dream Episode Diagnostics' })).toBeVisible();
  await expect(page.getByText('No managed lessons yet. Completed Dream runs can add lessons for review.')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  console.log('seam:portal-dream-empty-linked-e2e');
});

test('renders a structured Dream daily digest without a React child error', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.route('**/v1/agents/*/wake', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        upstream: {
          daily_digest: {
            last_run_id: 'dream-run-123',
            duration_ms: 842,
            episodes_consolidated: 4,
            memories_added: 7,
            memories_pruned: 1,
            contradictions_resolved: 2,
            summary_narrative: 'Consolidated four research episodes into seven durable memories.',
          },
        },
      }),
    });
  });

  await page.goto(`/${agentId}/dream-cycle`);

  await expect(page.getByText('Consolidated four research episodes into seven durable memories.')).toBeVisible();
  expect(pageErrors).toEqual([]);

  console.log('seam:portal-dream-structured-digest-e2e');
});

test('renders a Gateway-verified 0G REM memory vault entry', async ({ page }) => {
  await page.route('**/v1/agents/*/lessons', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, lessons: [{ id: 'lesson-0g-1', openx_agent_id: agentId, state: 'PROMOTED_CONSTRAINT', content: 'Keep payment quotes bound to proof.', source: 'dream_cycle', created_at: '2026-09-02T00:00:00.000Z', zerog_provenance: { status: 'uploaded', root_hash: '0x1234567890abcdef', tx_hash: '0xabcdef', explorer_url: 'https://scan-testnet.0g.ai/tx/0xabcdef', uploaded_at: '2026-09-02T00:01:00.000Z', proof_available: true } }] }) });
  });
  await page.route('**/v1/agents/*/lessons/lesson-0g-1/0g-proof', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, proof: { verified: true, provenance: { status: 'uploaded', proof_available: true }, canonical_payload: { version: '0g-dream-memory/v1', lesson_id: 'lesson-0g-1' } } }) });
  });
  await page.goto(`/${agentId}/dream-cycle`);
  await expect(page.getByRole('region', { name: '0G decentralized memory vault' })).toBeVisible();
  await expect(page.getByText('1/1 pinned')).toBeVisible();
  await page.getByRole('button', { name: 'View proof' }).click();
  await expect(page.getByRole('dialog')).toContainText('Merkle proof verified');
  console.log('seam:portal-dream-0g-vault-e2e');
});
