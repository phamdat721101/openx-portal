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

    it('rejects financial telemetry fields instead of accepting them', async () => {
      const res = await request(app)
        .post('/v1/agent/telemetry')
        .send({ agent_id: 'safe-agent', task_id: 'safe-task', model: 'gpt-5.6-luna', cost_usdc: '0.01' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_payload');
    });

    it('projects a fresh task heartbeat as a running Studio Hub task without returning its summary', async () => {
      await request(app).post('/v1/agent/telemetry').send({
        agent_id: 'task-agent', task_id: 'task-live-01', model: 'gemini-3.5', status: 'success',
        task_state: 'started', task_title: 'Safe task title', task_category: 'research', current_phase: 'collecting', progress_pct: 20,
        summary: 'This stays in the trace feed only.',
      });
      const response = await request(app).get('/v1/agents/activity');
      expect(response.status).toBe(200);
      const item = response.body.agents.find((agent: { agent_id: string }) => agent.agent_id === 'task-agent');
      expect(item.activity.current_task).toMatchObject({ task_id: 'task-live-01', state: 'running', title: 'Safe task title', phase: 'collecting' });
      expect(item.activity.current_task).not.toHaveProperty('summary');
    });

    it('accepts an agent-owned capability sync', async () => {
      const response = await request(app).post('/v1/agent/sync').send({ agent_id: 'sync-agent', model: 'gemini-3.5', tools: ['sheets.read'], skills: ['nim-skill'], plan_id: 'starter' });
      expect(response.status).toBe(200);
      expect(response.body.agent).toMatchObject({ agent_id: 'sync-agent', state: 'online' });
    });
  });

  describe('working-log persistence', () => {
    it('keeps ordered task entries and ignores duplicate event ids', () => {
      const entry = { event_id: '550e8400-e29b-41d4-a716-446655440000', sequence: 1, phase: 'collecting', progress_pct: 25, kind: 'phase', markdown: 'Collected safe sources.', created_at: '2026-09-04T00:00:00.000Z' };
      expect(agentIngestionStore.recordWorkingLog('task-agent', 'task-log-1', entry)).toMatchObject({ accepted: true, duplicate: false });
      expect(agentIngestionStore.recordWorkingLog('task-agent', 'task-log-1', entry)).toMatchObject({ accepted: false, duplicate: true });
      expect(agentIngestionStore.getWorkingLog('task-agent', 'task-log-1')).toEqual([expect.objectContaining({ sequence: 1, markdown: 'Collected safe sources.' })]);
    });

    // seam:task-log-ingestion
    it('accepts an authenticated log entry and returns it with the task detail', async () => {
      const agentId = 'task-log-route-agent';
      const taskId = 'task-log-route-1';
      await request(app).post('/v1/agent/telemetry').set('x-agent-key', 'development-key').send({ agent_id: agentId, task_id: taskId, model: 'gemini-3.5', status: 'success', task_state: 'started' });
      const created = await request(app).post(`/v1/agents/${agentId}/tasks/${taskId}/working-log`).set('x-agent-key', 'development-key').send({ event_id: '550e8400-e29b-41d4-a716-446655440001', sequence: 1, phase: 'collecting', progress_pct: 25, kind: 'phase', markdown: 'Collected safe sources.', created_at: '2026-09-04T00:00:00.000Z' });
      expect(created.status).toBe(201);
      const unsafe = await request(app).post(`/v1/agents/${agentId}/tasks/${taskId}/working-log`).set('x-agent-key', 'development-key').send({ event_id: '550e8400-e29b-41d4-a716-446655440002', sequence: 2, phase: 'collecting', kind: 'phase', markdown: '<script>unsafe</script>', created_at: '2026-09-04T00:00:00.000Z' });
      expect(unsafe.status).toBe(400);
      const detail = await request(app).get(`/v1/agents/${agentId}/tasks/${taskId}`);
      expect(detail.status).toBe(200);
      expect(detail.body.working_log).toEqual([expect.objectContaining({ sequence: 1, markdown: 'Collected safe sources.' })]);
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

    it('projects synced capabilities and candidate skills with metadata-only execution metrics', async () => {
      const agentId = 'test-agent-001';
      await request(app).post('/v1/agent/sync').set('x-agent-key', 'development-key').send({ agent_id: agentId, tools: ['sheets.read'], skills: ['risk.assess'] });
      await request(app).post('/v1/agent/telemetry').send({ agent_id: agentId, task_id: 'skill-metrics', model: 'gemini-3.5', tools_used: ['sheets.read'], latency_ms: 120, status: 'success' });
      await request(app).post('/v1/agent/skills/candidate').send({ agent_id: agentId, skill_slug: 'defi-risk-scorer', display_name: 'DeFi Risk Scorer', capability_ids: ['risk.assess'] });

      const catalog = await request(app).get(`/v1/agents/${agentId}/skills`);
      expect(catalog.status).toBe(200);
      expect(catalog.body.skills).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'capability:sheets.read', status: 'active', telemetry: expect.objectContaining({ total_calls: 1, avg_latency_ms: 120 }) }),
        expect.objectContaining({ slug: 'defi-risk-scorer', status: 'in_audit' }),
      ]));
      expect(JSON.stringify(catalog.body)).not.toContain('summary');

      const update = await request(app).post(`/v1/agents/${agentId}/skills/capability%3Asheets.read/status`).set('x-agent-key', 'development-key').send({ status: 'deprecated' });
      expect(update.status).toBe(200);
      expect(update.body.skill.status).toBe('deprecated');
    });
  });
});
