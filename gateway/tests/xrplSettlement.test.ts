import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';

// seam:settlement-auth-boundary
describe('XRPL Testnet service settlement boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('exposes configuration without a balance or withdrawal surface', async () => {
    const response = await request(app).get('/v1/settlement/xrpl-testnet');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, network: 'xrpl-testnet', service_payment_only: true });
    expect(response.body).not.toHaveProperty('withdraw');
    expect(response.body).not.toHaveProperty('balance');
  });

  it('does not accept a settlement proof while Testnet configuration is absent', async () => {
    vi.stubEnv('OPENX_XRPL_SETTLEMENT_ENABLED', 'false');
    const response = await request(app).post('/v1/settlement/xrpl-testnet/verify').send({ transaction_hash: 'A'.repeat(64), expected_amount: '1.25' });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ ok: false, verified: false, reason: 'xrpl_testnet_settlement_not_configured', service_payment_only: true });
  });

  it('returns settled payments history without exposing secret keys', async () => {
    const response = await request(app).get('/v1/settlement/history');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, network: 'xrpl-testnet', currency: 'RLUSD' });
    expect(Array.isArray(response.body.settlements)).toBe(true);
    expect(response.body).not.toHaveProperty('seed');
    expect(response.body).not.toHaveProperty('private_key');
  });

  it('confirms the standalone rlusd-analytics macro endpoint is removed', async () => {
    const response = await request(app).get('/v1/xrpl/rlusd-analytics');
    expect(response.status).toBe(404);
  });

  it('allows authenticated agents to sync on-chain settlements and retrieve them', async () => {
    const regRes = await request(app).post('/v1/agent/register').send({
      display_name: 'Settlement Sync Agent',
      host_type: 'custom',
    });
    expect(regRes.status).toBe(201);
    const agentId = regRes.body.agent.agent_id;
    const agentKey = regRes.body.credential.agent_key;

    const txHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const merchant = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';
    const facilitator = 'hypermove-relay-alpha';

    // Unauthorized sync rejected
    const unauthRes = await request(app)
      .post(`/v1/agents/${agentId}/settlements`)
      .send({
        transaction_hash: txHash,
        quote_id: 'quote-test-1',
        amount: '0.05',
        currency: 'RLUSD',
        merchant_address: merchant,
        facilitator_node: facilitator,
      });
    expect(unauthRes.status).toBe(401);

    // Invalid payload rejected
    const invalidRes = await request(app)
      .post(`/v1/agents/${agentId}/settlements`)
      .set('x-agent-key', agentKey)
      .send({
        transaction_hash: 'not-a-valid-hash',
        quote_id: 'quote-test-1',
        amount: '0.05',
        merchant_address: merchant,
        facilitator_node: facilitator,
      });
    expect(invalidRes.status).toBe(400);

    // Valid sync accepted
    const syncRes = await request(app)
      .post(`/v1/agents/${agentId}/settlements`)
      .set('x-agent-key', agentKey)
      .send({
        transaction_hash: txHash,
        quote_id: 'quote-test-1',
        amount: '0.05',
        currency: 'RLUSD',
        merchant_address: merchant,
        facilitator_node: facilitator,
        status: 'settled',
      });
    expect(syncRes.status).toBe(201);
    expect(syncRes.body.ok).toBe(true);
    expect(syncRes.body.settlement).toMatchObject({
      transaction_hash: txHash,
      merchant_address: merchant,
      facilitator_node: facilitator,
      amount: '0.05',
      currency: 'RLUSD',
      status: 'settled',
    });

    // Query history with agent_id query param
    const histRes1 = await request(app).get(`/v1/settlement/history?agent_id=${agentId}`);
    expect(histRes1.status).toBe(200);
    const found1 = histRes1.body.settlements.find((s: any) => s.transaction_hash === txHash);
    expect(found1).toBeDefined();
    expect(found1.facilitator_node).toBe(facilitator);
    expect(found1.merchant_address).toBe(merchant);

    // Query history with agentId alias query param
    const histRes2 = await request(app).get(`/v1/settlement/history?agentId=${agentId}`);
    expect(histRes2.status).toBe(200);
    const found2 = histRes2.body.settlements.find((s: any) => s.transaction_hash === txHash);
    expect(found2).toBeDefined();
  });
});
