import { describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.NODE_ENV = 'test';
const { app } = await import('../src/server.js');

describe('public WebMCP projection', () => {
  it('returns slim connected-agent data and a one-time registration key only on creation', async () => {
    const created = await request(app).post('/v1/webmcp/agents').send({
      display_name: 'WebMCP Agent', host_type: 'custom', model: 'test-model', capabilities: ['telemetry'],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ok: true, status: 'registered', credential: { shown_once: true } });
    expect(created.body.credential.agent_key).toMatch(/^oxag_/);
    expect(created.body.connection_prompt).toContain(`OPENX_AGENT_ID=${created.body.agent.agent_id}`);

    const agentId = created.body.agent.agent_id as string;
    const overview = await request(app).get(`/v1/webmcp/agents/${agentId}`);
    expect(overview.status).toBe(200);
    expect(overview.body.agent).toMatchObject({ agent_id: agentId, display_name: 'WebMCP Agent', state: 'registered' });
    expect(JSON.stringify(overview.body)).not.toContain('credential_hash');

    const wallet = await request(app).get(`/v1/webmcp/agents/${agentId}/wallet`);
    expect(wallet.status).toBe(200);
    expect(wallet.body.wallet).toMatchObject({ address: null, source_errors: expect.arrayContaining(['wallet_not_linked']) });

    const auditor = await request(app).get(`/v1/webmcp/agents/${agentId}/auditor`);
    expect(auditor.status).toBe(200);
    expect(auditor.body.auditor.latest_job).toMatchObject({ status: 'not_configured' });
  });

  it('strictly rejects unknown registration fields and applies the explicit public skill action', async () => {
    const invalid = await request(app).post('/v1/webmcp/agents').send({ display_name: 'Bad WebMCP Agent', host_type: 'custom', unexpected: true });
    expect(invalid.status).toBe(400);

    const created = await request(app).post('/v1/webmcp/agents').send({ display_name: 'Skill WebMCP Agent', host_type: 'custom', capabilities: ['research'] });
    const agentId = created.body.agent.agent_id as string;
    const skill = await request(app).post(`/v1/webmcp/agents/${agentId}/skills/capability%3Aresearch/status`).send({ status: 'deprecated' });
    expect(skill.status).toBe(200);
    expect(skill.body.skill).toMatchObject({ id: 'capability:research', status: 'deprecated' });

    const unlinkedDream = await request(app).post(`/v1/webmcp/agents/${agentId}/dream/trigger`).send({});
    expect(unlinkedDream.status).toBe(409);
    expect(unlinkedDream.body).toMatchObject({ ok: false, error: 'dream_not_linked' });
  });
});
