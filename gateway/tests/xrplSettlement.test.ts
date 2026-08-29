import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';

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
});
