import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentRegistry } from '../src/services/agentRegistry.js';
import { gatewayDatabase } from '../src/db/database.js';
import { statementHash } from '../src/services/statementTracking.js';

const report = { report_id: '11111111-1111-4111-8111-111111111111', content_hash: 'a'.repeat(64), visibility: 'public', source_chain: 'arbitrum-sepolia', source_block: '123', source_timestamp: '2026-09-09T00:00:00.000Z', finality: 'finalized', wallet_address: '0x1111111111111111111111111111111111111111', venue: 'Morpho', collateral_usd: 1000, debt_usd: 300, realized_pnl_usd: 42, pnl_methodology: 'realized swaps', attestation: { status: 'pending' } };
describe('statement report ingestion', () => {
  beforeEach(() => { agentRegistry.clear(); gatewayDatabase.raw().exec('DELETE FROM statement_executions; DELETE FROM statement_reports; DELETE FROM agent_knowledge_records;'); });
  it('migrates execution evidence fields for an existing Gateway database', () => {
    const columns = new Set((gatewayDatabase.raw().prepare('PRAGMA table_info(statement_executions)').all() as { name: string }[]).map((column) => column.name));
    expect(['ethereum_anchor_block', 'creditcoin_chain_id', 'creditcoin_block', 'creditcoin_verified_at'].every((column) => columns.has(column))).toBe(true);
  });
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
  it('recomputes APSD-L v2.1 canonical hashes before accepting a statement', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
    const canonical_envelope = { schema_version: 'apsd-l/2.1', report_id: report.report_id, position: { collateral_usd: '1000.00', debt_usd: '300.00' } };
    const v2 = { ...report, schema_version: 'apsd-l/2.1', canonical_envelope, content_hash: statementHash(canonical_envelope), the_graph_telemetry: { status: 'complete' }, oneinch_telemetry: { status: 'unavailable' }, pnl_attribution: {}, risk_engine_audit: {}, actionable_allocation_vector: {}, decision_context_card: 'safe context' };
    expect((await request(app).post(`/v1/agents/${registration.body.agent.agent_id}/statements`).set('x-agent-key', registration.body.credential.agent_key).send(v2)).status).toBe(201);
    expect((await request(app).post(`/v1/agents/${registration.body.agent.agent_id}/statements`).set('x-agent-key', registration.body.credential.agent_key).send({ ...v2, report_id: '22222222-2222-4222-8222-222222222222', content_hash: 'b'.repeat(64) })).status).toBe(400);
  });
  it('keeps browser-wallet execution unavailable until the testnet registry is configured', async () => {
    const originalEnabled = process.env.OPENX_STATEMENT_EXECUTION_ENABLED;
    process.env.OPENX_STATEMENT_EXECUTION_ENABLED = 'false';
    try {
      const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
      const agentId = registration.body.agent.agent_id; const key = registration.body.credential.agent_key;
      await request(app).post(`/v1/agents/${agentId}/statements`).set('x-agent-key', key).send(report);
      const response = await request(app).post(`/v1/agents/${agentId}/statements/${report.report_id}/executions/prepare`).send({ wallet_address: '0x1111111111111111111111111111111111111111' });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('statement_execution_not_configured');
    } finally {
      if (originalEnabled === undefined) delete process.env.OPENX_STATEMENT_EXECUTION_ENABLED;
      else process.env.OPENX_STATEMENT_EXECUTION_ENABLED = originalEnabled;
    }
  });
  it('keeps Fusion deleveraging unavailable without its explicit provider configuration', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Research agent', host_type: 'custom' });
    await request(app).post(`/v1/agents/${registration.body.agent.agent_id}/statements`).set('x-agent-key', registration.body.credential.agent_key).send(report);
    const response = await request(app).post(`/v1/agents/${registration.body.agent.agent_id}/statements/rebalance/prepare`).send({ report_id: report.report_id, wallet_address: '0x1111111111111111111111111111111111111111' });
    expect(response.status).toBe(409); expect(response.body.error).toBe('oneinch_fusion_not_configured');
  });
});
