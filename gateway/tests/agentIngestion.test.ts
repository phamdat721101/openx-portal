import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentIngestionStore } from '../src/services/agentIngestionStore.js';

describe('Gateway Ingestion & Telemetry APIs (PRD Ingestion Tests)', () => {
  beforeEach(() => {
    agentIngestionStore.clear();
  });

  describe('POST /v1/agent/telemetry', () => {
    it('returns 400 when agent_id or task_id is missing', async () => {
      const res = await request(app)
        .post('/v1/agent/telemetry')
        .send({ model: 'gemini-3.5' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toBe('invalid_payload');
    });

    it('ingests execution telemetry and updates state store', async () => {
      const payload = {
        agent_id: 'test-agent-001',
        task_id: 'task-scan-01',
        model: 'gemini-3.5',
        tokens_consumed: 1200,
        tools_used: ['google-workspace-cli.sheets.read'],
        latency_ms: 450,
        status: 'success',
        cost_usdc: '0.012',
      };

      const res = await request(app)
        .post('/v1/agent/telemetry')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.event_type).toBe('telemetry');
      expect(res.body.agent_id).toBe('test-agent-001');
      expect(res.body.id).toBeDefined();

      // Verify GET /v1/agent/telemetry returns it
      const getRes = await request(app).get('/v1/agent/telemetry?agentId=test-agent-001');
      expect(getRes.status).toBe(200);
      expect(getRes.body.count).toBe(1);
      expect(getRes.body.traces[0].task_id).toBe('task-scan-01');
    });
  });

  describe('POST /v1/agent/memory/episode', () => {
    it('ingests research episode and updates memory summary in GET /v1/agent/status', async () => {
      const episode = {
        agent_id: 'test-agent-001',
        episode_type: 'protocol_research',
        summary: 'Aave v3 total market utilization increased 4.2%',
        facts_count: 2,
        confidence: 0.96,
        entities: ['Aave v3'],
      };

      const res = await request(app)
        .post('/v1/agent/memory/episode')
        .send(episode);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.event_type).toBe('memory_episode');

      // Check that GET /v1/agent/status now reflects the live memory episode count
      const statusRes = await request(app).get('/v1/agent/status?agentId=test-agent-001');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.memory.episodes).toBe(1);
      expect(statusRes.body.memory.facts).toBe(2);
    });
  });

  describe('POST /v1/agent/skills/candidate', () => {
    it('registers candidate skill template', async () => {
      const skill = {
        agent_id: 'test-agent-001',
        skill_slug: 'defi-risk-scorer',
        display_name: 'DeFi Liquidity Risk Scorer',
        capability_ids: ['risk.assess', 'sheets.write'],
      };

      const res = await request(app)
        .post('/v1/agent/skills/candidate')
        .send(skill);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.event_type).toBe('skill_candidate');
    });
  });
});
