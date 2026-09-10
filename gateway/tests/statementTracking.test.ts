import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentRegistry } from '../src/services/agentRegistry.js';
import { gatewayDatabase } from '../src/db/database.js';

const report = { report_id: '11111111-1111-4111-8111-111111111111', content_hash: 'a'.repeat(64), visibility: 'public', source_chain: 'arbitrum-sepolia', source_block: '123', source_timestamp: '2026-09-09T00:00:00.000Z', finality: 'finalized', wallet_address: '0x1111111111111111111111111111111111111111', venue: 'Morpho', collateral_usd: 1000, debt_usd: 300, realized_pnl_usd: 42, pnl_methodology: 'realized swaps', attestation: { status: 'pending' } };
describe('statement report ingestion', () => {
  beforeEach(() => { agentRegistry.clear(); gatewayDatabase.raw().exec('DELETE FROM statement_reports; DELETE FROM agent_knowledge_records;'); });
  it('accepts an authenticated report idempotently and exposes its public projection', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id; const key = registration.body.credential.agent_key;
    const first = await request(app).post(`/v1/agents/${agentId}/statements`).set('x-agent-key', key).send(report);
    const replay = await request(app).post(`/v1/agents/${agentId}/statements`).set('x-agent-key', key).send(report);
    const latest = await request(app).get(`/v1/agents/${agentId}/statements/latest`);
    const board = await request(app).get('/v1/statements/leaderboard');
    expect(first.status).toBe(201); expect(replay.status).toBe(200); expect(latest.body.report.ltv).toBe(.3); expect(board.body.reports).toHaveLength(1);
  });
  it('rejects unauthenticated reports and LTV above the policy cap', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id;
    expect((await request(app).post(`/v1/agents/${agentId}/statements`).send(report)).status).toBe(401);
    expect((await request(app).post(`/v1/agents/${agentId}/statements`).set('x-agent-key', registration.body.credential.agent_key).send({ ...report, debt_usd: 401 })).status).toBe(400);
  });
  it('keeps browser-wallet execution unavailable until the testnet registry is configured', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id; const key = registration.body.credential.agent_key;
    await request(app).post(`/v1/agents/${agentId}/statements`).set('x-agent-key', key).send(report);
    const response = await request(app).post(`/v1/agents/${agentId}/statements/${report.report_id}/executions/prepare`).send({ wallet_address: '0x1111111111111111111111111111111111111111' });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('statement_execution_not_configured');
  });
});
