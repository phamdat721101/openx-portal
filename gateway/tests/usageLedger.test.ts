import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { usageLedger } from '../src/services/usageLedger.js';
import { agentRegistry } from '../src/services/agentRegistry.js';

describe('usage ledger API', () => {
  afterEach(() => { usageLedger.clear(); agentRegistry.clear(); });

  it('prices detailed usage, tracks nim savings, and ignores an idempotent duplicate', async () => {
    const payload = {
      event_id: 'usage-001', agent_id: 'usage-agent', occurred_at: '2026-08-26T12:00:00.000Z', plan_id: 'starter',
      model_usage: [{ provider: 'google', model: 'gemini-3.5', input_tokens: 1_000_000, output_tokens: 1_000_000 }],
      tool_calls: [{ tool_id: 'google-search', calls: 1, outcome: 'success' }],
      skill_invocations: [{ skill_id: 'nim-skill', calls: 1, outcome: 'success' }],
      nim_savings: [{ primitive: 'nim-logcompact', model: 'gemini-3.5', token_kind: 'input', baseline_tokens: 1_000, actual_tokens: 400 }],
    };
    expect((await request(app).post('/v1/agent/usage-events').send(payload)).status).toBe(201);
    expect((await request(app).post('/v1/agent/usage-events').send(payload)).body.created).toBe(false);
    const response = await request(app).get('/v1/agents/usage-agent/usage-summary?month=2026-08');
    expect(response.status).toBe(200);
    expect(response.body.summary).toMatchObject({ usage_events: 1, input_tokens: 1_000_000, output_tokens: 1_000_000, tool_calls: 1, skill_calls: 1, nim_tokens_saved: 600 });
    expect(response.body.summary).not.toHaveProperty('provider_cost_micro_usdc');
    expect(response.body.summary).not.toHaveProperty('gross_billed_micro_usdc');
    expect(response.body.summary).not.toHaveProperty('net_earnings_micro_usdc');
    expect(response.body.summary).not.toHaveProperty('platform_fee_micro_usdc');
    expect(response.body.summary).not.toHaveProperty('nim_avoided_cost_micro_usdc');
  });

  it('rejects raw prompt-shaped fields and reports unknown models as unpriced', async () => {
    const invalid = await request(app).post('/v1/agent/usage-events').send({ event_id: 'bad', agent_id: 'usage-agent', occurred_at: '2026-08-26T12:00:00.000Z', prompt: 'secret' });
    expect(invalid.status).toBe(400);
    const valid = await request(app).post('/v1/agent/usage-events').send({ event_id: 'unknown', agent_id: 'usage-agent', occurred_at: '2026-08-26T12:00:00.000Z', model_usage: [{ provider: 'other', model: 'unpriced-model', input_tokens: 50 }] });
    expect(valid.status).toBe(201);
    const summary = await request(app).get('/v1/agents/usage-agent/usage-summary?month=2026-08');
    expect(summary.body.summary.unpriced_items).toBe(1);
    expect(summary.body.summary).not.toHaveProperty('provider_cost_micro_usdc');
  });

  it('requires an authenticated read in production mode', async () => {
    const previousMode = process.env.OPENX_AGENT_REGISTRATION_MODE;
    process.env.OPENX_AGENT_REGISTRATION_MODE = 'production';
    try {
      expect(process.env.OPENX_AGENT_REGISTRATION_MODE).toBe('production');
      expect((await request(app).get('/v1/agents/usage-agent/usage-summary')).status).toBe(401);
      expect((await request(app).get('/v1/usage-summary')).status).toBe(401);
    } finally {
      if (previousMode === undefined) delete process.env.OPENX_AGENT_REGISTRATION_MODE;
      else process.env.OPENX_AGENT_REGISTRATION_MODE = previousMode;
    }
  });
});
