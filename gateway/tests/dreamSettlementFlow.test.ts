import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentRegistry } from '../src/services/agentRegistry.js';
import { HyperMoveClient, McpError, dreamState } from '../src/services/dreamGateway.js';
import { nPaymentXrplWallet } from '../src/services/nPaymentXrplWallet.js';

const HASH = 'B'.repeat(64);

describe('Dream XRPL n-payment settlement', () => {
  // seam:n-payment-signer
  // seam:quote-nonce-validation
  // seam:xrpl-ledger-verification
  // seam:payment-settlement-resume
  // seam:portal-learning-output
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('uses the explicit local nim XRPL seed alias without persisting it', () => {
    vi.stubEnv('OPENX_XRPL_SETTLEMENT_ENABLED', 'true');
    vi.stubEnv('OPENX_NPAYMENT_BIN', 'n-payment-skill');
    vi.stubEnv('XRPL_SEED', '');
    vi.stubEnv('NIM_XRPL_TEST_SEED', 'device-local-nim-test-seed');

    expect(nPaymentXrplWallet.isConfigured()).toBe(true);
  });

  it('settles a nonce-bound quote once, resumes Dream, and retains a reviewable lesson', async () => {
    const quoteId = `quote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const transactionHash = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padStart(64, 'A').slice(-64);
    process.env.OPENX_XRPL_SETTLEMENT_ENABLED = 'true';
    process.env.OPENX_NPAYMENT_BIN = 'n-payment-skill';
    process.env.XRPL_SEED = 'device-local-test-seed';
    process.env.XRPL_TESTNET_RPC_URL = 'https://xrpl.test';
    process.env.OPENX_RLUSD_CURRENCY = 'RLUSD';
    process.env.OPENX_RLUSD_ISSUER = 'issuer';
    process.env.OPENX_XRPL_DESTINATION = 'merchant';
    process.env.HYPERMOVE_MCP_URL = 'https://hypermove.test/mcp';
    process.env.HYPERMOVE_MCP_SERVICE_TOKEN = 'service-token';
    process.env.OPENX_DREAM_SELF_SERVICE_ENABLED = 'true';
    agentRegistry.clear();
    vi.spyOn(nPaymentXrplWallet, 'payRlusd').mockResolvedValue({ transaction_hash: transactionHash, validated: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { validated: true, meta: { TransactionResult: 'tesSUCCESS', delivered_amount: { value: '0.0500', currency: Buffer.from('RLUSD').toString('hex').padEnd(40, '0').toUpperCase(), issuer: 'issuer' } }, tx_json: { TransactionType: 'Payment', Destination: 'merchant', Memos: [{ Memo: { MemoData: Buffer.from('quote-nonce').toString('hex') } }] } } }) }));
    let starts = 0;
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockImplementation(async (name: string) => {
      if (name === 'get_dream_readiness') return { ready: true };
      if (name === 'submit_episode_log') return { status: 'submitted' };
      if (name === 'payments.settle') return { settled: true };
      if (name === 'start_dream' && starts++ === 0) throw new McpError(402, { quote_id: quoteId, amount: '0.05', currency: 'RLUSD', destination: 'merchant', issuer: 'issuer', nonce: 'quote-nonce' });
      return { status: 'completed', stage_summaries: { extraction: { facts: 1 } }, morning_brief: 'One fact retained.', lessons: ['Recheck a quote before spending.'] };
    });

    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Settlement agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    await request(app).post(`/v1/agents/${agentId}/dream/setup`).send({});
    const response = await request(app).post(`/v1/agents/${agentId}/dream/trigger`).send({ budget_usd: 0.05 });

    expect(response.status).toBe(202);
    expect(response.body.run).toMatchObject({ status: 'completed', settlement: { status: 'settled', quote_id: quoteId, transaction_hash: transactionHash }, learning_brief: { morning_brief: 'One fact retained.' } });
    expect(call.mock.calls.filter(([name]) => name === 'start_dream')).toHaveLength(2);
    expect(call.mock.calls.filter(([name]) => name === 'start_dream')[1]?.[3]).toEqual({ 'x-payment': transactionHash, 'x-payment-quote-id': quoteId });
    expect(dreamState.listLessons(agentId)).toMatchObject([{ content: 'Recheck a quote before spending.', source: 'dream_cycle', state: 'UNREVIEWED' }]);
  });

  it('does not expose a direct settlement bypass', async () => {
    const response = await request(app).post('/v1/agents/any/dream/settle').send({ quote_id: 'quote', proof: HASH });
    expect(response.status).toBe(410);
    expect(response.body.error).toBe('direct_settlement_disabled');
  });
});
