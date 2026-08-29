import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';

describe('Gateway Core Backend Server (PRD 001 Tests)', () => {
  it('GET /health returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('openx-deep-research-analyst-gateway');
  });

  describe('GET /v1/agent/status', () => {
    it('returns 400 when agentId is missing', async () => {
      const res = await request(app).get('/v1/agent/status');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'missing_agent_id',
        message: 'agentId query parameter is required',
      });
    });

    it('returns 400 when fields parameter has 0 recognized tokens', async () => {
      const res = await request(app).get('/v1/agent/status?agentId=test-agent&fields=foo,bar');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'invalid_fields',
        message: 'fields must be a comma-separated subset of: info,status,model,memory',
      });
    });

    it('returns 200 with operational sections and no financial status data when valid agentId is provided', async () => {
      const res = await request(app).get('/v1/agent/status?agentId=3fa85f64-5717-4562-b3fc-2c963f66afa6');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.agent_id).toBe('3fa85f64-5717-4562-b3fc-2c963f66afa6');
      expect(res.body.requested_at).toBeDefined();

      // Check operational sections; financial/account state is intentionally absent.
      expect(res.body.info).toBeDefined();
      expect(res.body.status).toBeDefined();
      expect(res.body.model).toBeDefined();
      expect(res.body.memory).toBeDefined();
      expect(res.body.credits).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/balance|earning|withdraw|reputation/i);

      // Check honest degradation reasons when no upstream or auth provided
      expect(res.body.info.erc8004.reason).toBe('no_header');
      expect(res.body.status.reachable).toBe(true);
    });

    it('returns 200 and narrows fields when fields parameter is specified', async () => {
      const res = await request(app).get(
        '/v1/agent/status?agentId=3fa85f64-5717-4562-b3fc-2c963f66afa6&fields=status,model'
      );
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBeDefined();
      expect(res.body.model).toBeDefined();
      expect(res.body.info).toBeUndefined();
      expect(res.body.credits).toBeUndefined();
      expect(res.body.memory).toBeUndefined();
    });

    it('forward-compatibility: silently ignores unknown tokens when at least one valid field is present', async () => {
      const res = await request(app).get(
        '/v1/agent/status?agentId=3fa85f64-5717-4562-b3fc-2c963f66afa6&fields=status,unknown_future_field'
      );
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.status).toBeDefined();
      expect(res.body.info).toBeUndefined();
    });
  });
});
