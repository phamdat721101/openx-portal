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
  });
});
