import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { DreamStateStore, dreamState, HyperMoveClient, McpError } from '../src/services/dreamGateway.js';
import { app } from '../src/server.js';
import { agentRegistry } from '../src/services/agentRegistry.js';

describe('DreamStateStore', () => {
  it('persists links, runs, and OpenX constraint promotions across recreation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'openx-dream-'));
    const path = join(directory, 'dream-state.json');
    try {
      const first = new DreamStateStore(path, Buffer.alloc(32, 7).toString('base64'));
      const link = first.link('openx-agent', 'hypermove-agent');
      const run = first.createRun('openx-agent', link, 'balanced', 0.1);
      first.updateRun(run.id, { status: 'completed', completed_at: '2026-08-25T00:00:00.000Z' });
      const lesson = first.addLesson('openx-agent', 'Always retry using the quote-bound payment proof.');
      first.resolveLesson('openx-agent', lesson.id, 'PROMOTED_CONSTRAINT');

      first.setMcpToken('openx-agent', 'agent-specific-hypermove-token');
      first.cacheWakeContext('openx-agent', { daily_digest: 'Cached morning brief.' });
      const restored = new DreamStateStore(path, Buffer.alloc(32, 7).toString('base64'));
      expect(restored.getLink('openx-agent')).toMatchObject({ hypermove_agent_id: 'hypermove-agent' });
      expect(restored.latestRun('openx-agent')).toMatchObject({ status: 'completed' });
      expect(restored.listLessons('openx-agent')).toMatchObject([{ state: 'PROMOTED_CONSTRAINT' }]);
      expect(restored.getMcpToken('openx-agent')).toBe('agent-specific-hypermove-token');
      expect(restored.getCachedWakeContext('openx-agent')).toMatchObject({ upstream: { daily_digest: 'Cached morning brief.' } });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it('orders latestRun by timestamp so completed runs take precedence over older payment_required runs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'openx-dream-order-'));
    const path = join(directory, 'dream-state.json');
    try {
      const store = new DreamStateStore(path, Buffer.alloc(32, 7).toString('base64'));
      const link = store.link('agent-timestamp-test', 'hypermove-agent');
      const run1 = store.createRun('agent-timestamp-test', link, 'balanced', 0.05);
      store.updateRun(run1.id, { status: 'payment_required', created_at: '2026-08-31T12:00:00.000Z' });

      const imported = store.importCompletedRun('agent-timestamp-test', link, { memories_count: 5 }, { generated_at: '2026-08-31T12:30:00.000Z', stage_summaries: {}, constraints_count: 0 }, 'fingerprint-1');
      store.updateRun(imported.run.id, { created_at: '2026-08-31T12:30:00.000Z', completed_at: '2026-08-31T12:30:00.000Z' });

      const latest = store.latestRun('agent-timestamp-test');
      expect(latest).toBeDefined();
      expect(latest?.id).toBe(imported.run.id);
      expect(latest?.status).toBe('completed');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe('Dream Gateway routes', () => {
  it('reconciles an asynchronous Dream run to a terminal state without starting another run', async () => {
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString('base64');
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Reconciliation Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    const link = dreamState.link(agentId, agentId);
    dreamState.setMcpToken(agentId, 'reconciliation-hypermove-token');
    const run = dreamState.createRun(agentId, link, 'balanced', 0.1);
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockResolvedValue({ status: 'completed', memories_count: 3, stage_summaries: { consolidation: { memory_nodes_updated: 3 } } });

    const response = await request(app).post(`/v1/agents/${agentId}/dream/reconcile`).send({});

    expect(response.status).toBe(200);
    expect(response.body.run).toMatchObject({ id: run.id, status: 'completed', reconciliation: { upstream_status: 'completed' } });
    expect(call).toHaveBeenCalledWith('get_dream_stats', { agent_id: agentId }, expect.any(String));
    expect(dreamState.latestRun(agentId)).toMatchObject({ status: 'completed' });
    call.mockRestore();
  });

  it('keeps a run blocked when upstream status cannot be reconciled', async () => {
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString('base64');
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Unavailable Reconciliation Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    const link = dreamState.link(agentId, agentId);
    dreamState.setMcpToken(agentId, 'unavailable-reconciliation-token');
    const run = dreamState.createRun(agentId, link, 'balanced', 0.1);
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockRejectedValue(new McpError(503, { error: 'hypermove_unavailable' }));

    const reconciled = await request(app).post(`/v1/agents/${agentId}/dream/reconcile`).send({});
    const retrigger = await request(app).post(`/v1/agents/${agentId}/dream/trigger`).send({});

    expect(reconciled.body.run).toMatchObject({ id: run.id, status: 'running', reconciliation: { last_error: expect.any(String) } });
    expect(retrigger.status).toBe(409);
    expect(retrigger.body.error).toBe('dream_run_active');
    expect(call).toHaveBeenCalledTimes(1);
    call.mockRestore();
  });

  it('imports an externally completed Dream once without overwriting a stale payment-required Gateway run', async () => {
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 14).toString('base64');
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'External Dream Import Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    const link = dreamState.link(agentId, agentId);
    dreamState.setMcpToken(agentId, 'external-dream-import-token');
    const staleRun = dreamState.createRun(agentId, link, 'balanced', 0.1);
    dreamState.updateRun(staleRun.id, { status: 'payment_required' });
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockResolvedValue({ status: 'completed', run_id: 'hypermove-completed-run-1', memories_count: 4, stage_summaries: { consolidation: { memory_nodes_updated: 4 } }, daily_digest: 'External Dream completion imported.' });

    const first = await request(app).post(`/v1/agents/${agentId}/dream/sync`).send({});
    const second = await request(app).post(`/v1/agents/${agentId}/dream/sync`).send({});
    const overview = await request(app).get('/v1/agents/overview');

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, imported: true, run: { status: 'completed', source: 'hypermove_sync' } });
    expect(second.body).toMatchObject({ ok: true, imported: false, run: { id: first.body.run.id, status: 'completed' } });
    expect(dreamState.getRun(staleRun.id)).toMatchObject({ status: 'payment_required' });
    expect(dreamState.latestRun(agentId)).toMatchObject({ id: first.body.run.id, status: 'completed', source: 'hypermove_sync' });
    expect(overview.body.agents.find((item: { agent: { agent_id: string } }) => item.agent.agent_id === agentId).dream.latest_run).toMatchObject({ id: first.body.run.id, status: 'completed', source: 'hypermove_sync' });
    call.mockRestore();
  });

  it('requires a link before a run and supports the OpenX lesson overlay lifecycle', async () => {
    agentRegistry.clear();
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Dream route agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    const trigger = await request(app).post(`/v1/agents/${agentId}/dream/trigger`).send({});
    expect(trigger.status).toBe(409);
    expect(trigger.body.error).toBe('dream_not_linked');

    const created = await request(app).post(`/v1/agents/${agentId}/lessons`).send({ content: 'Keep payment quotes bound to their proof.' });
    expect(created.status).toBe(201);
    const resolved = await request(app).post(`/v1/agents/${agentId}/lessons/${created.body.lesson.id}/resolve`).send({ action: 'PROMOTED_CONSTRAINT' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.lesson.state).toBe('PROMOTED_CONSTRAINT');

    const lessons = await request(app).get(`/v1/agents/${agentId}/lessons`);
    expect(lessons.status).toBe(200);
    expect(lessons.body.lessons[0].zerog_provenance).toMatchObject({ status: 'disabled', proof_available: false });

    const proof = await request(app).get(`/v1/agents/${agentId}/lessons/${created.body.lesson.id}/0g-proof`);
    expect(proof.status).toBe(409);
    expect(proof.body).toMatchObject({ ok: false, error: 'proof_not_available', provenance: { status: 'disabled' } });
  });

  it('securely manages agent-specific HyperMove credentials via PUT /v1/agents/:agentId/dream/credential', async () => {
    process.env.OPENX_DREAM_CREDENTIAL_ADMIN_TOKEN = 'test-admin-secret-token-12345';
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');

    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Credential Test Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;

    // 1. Missing Authorization header -> 401
    const noAuth = await request(app)
      .put(`/v1/agents/${agentId}/dream/credential`)
      .send({ token: 'mock-hypermove-bearer-token-1234567890' });
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toBe('invalid_dream_credential_authorization');

    // 2. Wrong Authorization header -> 401
    const badAuth = await request(app)
      .put(`/v1/agents/${agentId}/dream/credential`)
      .set('Authorization', 'Bearer wrong-secret')
      .send({ token: 'mock-hypermove-bearer-token-1234567890' });
    expect(badAuth.status).toBe(401);

    // 3. Valid Authorization header -> 204 No Content
    const valid = await request(app)
      .put(`/v1/agents/${agentId}/dream/credential`)
      .set('Authorization', 'Bearer test-admin-secret-token-12345')
      .send({ token: 'mock-hypermove-bearer-token-1234567890' });
    expect(valid.status).toBe(204);

    // 4. Verify token is stored and can be retrieved internally, but is NEVER exposed via GET
    expect(dreamState.hasMcpToken(agentId)).toBe(true);
    expect(dreamState.getMcpToken(agentId)).toBe('mock-hypermove-bearer-token-1234567890');

    const agentDetail = await request(app).get(`/v1/agents/${agentId}`);
    expect(agentDetail.status).toBe(200);
    expect(JSON.stringify(agentDetail.body)).not.toContain('mock-hypermove-bearer-token-1234567890');
  });

  it('does not persist a supplied setup token or create a link when remote readiness rejects it', async () => {
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 10).toString('base64');
    process.env.HYPERMOVE_MCP_URL = 'http://127.0.0.1:1';
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Atomic Dream Setup Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockRejectedValue(new McpError(503, { error: 'hypermove_unavailable' }));
    const setup = await request(app).post(`/v1/agents/${agentId}/dream/setup`).set('x-agent-key', registration.body.credential.agent_key).send({ token: 'rejected-hypermove-bearer-token-1234567890' });
    expect(setup.status).toBeGreaterThanOrEqual(400);
    expect(dreamState.hasMcpToken(agentId)).toBe(false);
    expect(dreamState.getLink(agentId)).toBeUndefined();
    call.mockRestore();
  });
});
