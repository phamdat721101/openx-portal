import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentIngestionStore } from '../src/services/agentIngestionStore.js';
import { agentRegistry } from '../src/services/agentRegistry.js';

describe('Agent registration to portal fleet E2E', () => {
  beforeEach(() => {
    agentIngestionStore.clear();
    agentRegistry.clear();
  });

  it('registers, accepts a heartbeat, and exposes a redacted fleet record', async () => {
    // seam:host-registration
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Host Adapter Agent', host_type: 'adk-python', capabilities: ['research'] });
    expect(registration.status).toBe(201);
    expect(registration.body.credential.agent_key).toMatch(/^oxag_/);
    expect(registration.body.agent).not.toHaveProperty('credential_hash');

    const agentId = registration.body.agent.agent_id;
    const heartbeat = await request(app).post('/v1/agent/telemetry').send({ agent_id: agentId, task_id: 'e2e-001', model: 'gemini-3.5', tokens_consumed: 8, status: 'success' });
    expect(heartbeat.status).toBe(201);

    const fleet = await request(app).get('/v1/agents');
    expect(fleet.body.agents).toEqual(expect.arrayContaining([expect.objectContaining({ agent_id: agentId, state: 'online' })]));
    const overview = await request(app).get('/v1/agents/overview');
    expect(overview.status).toBe(200);
    expect(overview.body.agents).toEqual(expect.arrayContaining([expect.objectContaining({ agent: expect.objectContaining({ agent_id: agentId }), connection: expect.objectContaining({ state: 'online' }), dream: { linked: false, hypermove_agent_id: null }, audit: expect.objectContaining({ ready: true }) })]));
  });

  it('allows public production registration while requiring the issued key for writes', async () => {
    // seam:public-production-registration
    const previousMode = process.env.OPENX_AGENT_REGISTRATION_MODE;
    const previousConnectToken = process.env.OPENX_CONNECT_TOKEN;
    const previousApiBaseUrl = process.env.OPENX_API_BASE_URL;
    process.env.OPENX_AGENT_REGISTRATION_MODE = 'production';
    process.env.OPENX_CONNECT_TOKEN = 'legacy-token-must-not-gate-registration';
    process.env.OPENX_API_BASE_URL = 'https://gateway.example.com/';
    try {
      const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Public Production Agent', host_type: 'custom' });
      expect(registration.status).toBe(201);
      expect(registration.body.telemetry_endpoint).toBe('https://gateway.example.com/v1/agent/telemetry');

      const agentId = registration.body.agent.agent_id;
      const payload = { agent_id: agentId, task_id: 'public-production-001', model: 'qwen2.5-omni', status: 'success' };
      expect((await request(app).post('/v1/agent/telemetry').send(payload)).status).toBe(401);
      expect((await request(app).post('/v1/agent/telemetry').set('x-agent-key', registration.body.credential.agent_key).send(payload)).status).toBe(201);
    } finally {
      if (previousMode === undefined) delete process.env.OPENX_AGENT_REGISTRATION_MODE;
      else process.env.OPENX_AGENT_REGISTRATION_MODE = previousMode;
      if (previousConnectToken === undefined) delete process.env.OPENX_CONNECT_TOKEN;
      else process.env.OPENX_CONNECT_TOKEN = previousConnectToken;
      if (previousApiBaseUrl === undefined) delete process.env.OPENX_API_BASE_URL;
      else process.env.OPENX_API_BASE_URL = previousApiBaseUrl;
    }
  });
});
