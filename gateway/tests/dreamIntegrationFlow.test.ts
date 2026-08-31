import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { agentRegistry } from '../src/services/agentRegistry.js';
import { DreamStateStore, dreamState, hyperMove, HyperMoveClient } from '../src/services/dreamGateway.js';
import { agentIngestionStore } from '../src/services/agentIngestionStore.js';

describe('End-to-End Dream Cycle Integration Flow', () => {
  it('allows explicitly opted-in public Portal-managed setup in production', async () => {
    const previous = {
      mode: process.env.OPENX_AGENT_REGISTRATION_MODE,
      url: process.env.HYPERMOVE_MCP_URL,
      token: process.env.HYPERMOVE_MCP_SERVICE_TOKEN,
      publicSetup: process.env.OPENX_DREAM_PUBLIC_SETUP_ENABLED,
    };
    process.env.OPENX_AGENT_REGISTRATION_MODE = 'production';
    process.env.HYPERMOVE_MCP_URL = 'https://hypermove.test/mcp';
    process.env.HYPERMOVE_MCP_SERVICE_TOKEN = 'server-managed-test-token';
    process.env.OPENX_DREAM_PUBLIC_SETUP_ENABLED = 'true';
    agentRegistry.clear();
    const call = vi.spyOn(HyperMoveClient.prototype, 'call').mockResolvedValue({ ready: true });
    try {
      const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Public Dream Agent', host_type: 'custom' });
      const agentId = registration.body.agent.agent_id as string;
      const readiness = await request(app).get(`/v1/agents/${agentId}/dream/readiness`);
      expect(readiness.body).toMatchObject({ ok: true, ready: true, using_service_credential: true, self_service_enabled: true });
      const setup = await request(app).post(`/v1/agents/${agentId}/dream/setup`).send({});
      expect(setup.status).toBe(201);
      expect(setup.body).toMatchObject({ setup_mode: 'portal_managed', link: { hypermove_agent_id: agentId } });
    } finally {
      call.mockRestore();
      const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
      restore('OPENX_AGENT_REGISTRATION_MODE', previous.mode);
      restore('HYPERMOVE_MCP_URL', previous.url);
      restore('HYPERMOVE_MCP_SERVICE_TOKEN', previous.token);
      restore('OPENX_DREAM_PUBLIC_SETUP_ENABLED', previous.publicSetup);
    }
  });

  it('executes full lifecycle: setup -> telemetry -> trigger -> stage summaries -> wake context', async () => {
    process.env.OPENX_DREAM_CREDENTIAL_ADMIN_TOKEN = 'test-admin-secret-token-12345';
    process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString('base64');
    process.env.HYPERMOVE_MCP_URL = 'https://hypermove.duckdns.org/api/mcp';
    process.env.HYPERMOVE_MCP_SERVICE_TOKEN = 'openx-server-managed-hypermove-token';
    process.env.OPENX_DREAM_SELF_SERVICE_ENABLED = 'true';

    agentRegistry.clear();

    // 1. Agent Registration
    const regRes = await request(app)
      .post('/v1/agent/register')
      .send({ display_name: 'Flow Test Agent', host_type: 'custom' });
    expect(regRes.status).toBe(201);
    const agentId = regRes.body.agent.agent_id;

    // 2. Ingest Telemetry Traces
    const telRes1 = await request(app)
      .post('/v1/agent/telemetry')
      .send({
        agent_id: agentId,
        task_id: 'task_001',
        model: 'gemini-3.5',
        tokens_consumed: 1200,
        tools_used: ['search_tool', 'analyzer'],
        latency_ms: 340,
        status: 'success',
        summary: 'Researched Uniswap v4 hook architecture',
      });
    expect(telRes1.status).toBe(201);

    const telRes2 = await request(app)
      .post('/v1/agent/telemetry')
      .send({
        agent_id: agentId,
        task_id: 'task_002',
        model: 'gemini-3.5',
        tokens_consumed: 2500,
        tools_used: ['solidity_compiler'],
        latency_ms: 1200,
        status: 'failed',
        summary: 'Compilation failed due to missing pragma 0.8.26',
      });
    expect(telRes2.status).toBe(201);

    // 3. Mock the server-managed HyperMove integration.
    const hyperMoveCalls: Array<{ name: string; args: any; token?: string }> = [];
    vi.spyOn(HyperMoveClient.prototype, 'call').mockImplementation(async (name: string, args: Record<string, unknown>, token?: string) => {
      hyperMoveCalls.push({ name, args, token });
      if (name === 'get_dream_readiness') {
        return { ready: true, memories_count: 5, agent_id: args.agent_id };
      }
      if (name === 'submit_episode_log') {
        return { status: 'submitted', episodes_count: (args.episodes as any[])?.length || 0 };
      }
      if (name === 'start_dream') {
        return {
          status: 'completed',
          run_id: 'dream-run-abc-123',
          stage_summaries: {
            preprocessing: { episodes_processed: 2, duplicates_filtered: 0 },
            extraction: { constraints_extracted: 2, patterns_found: 1 },
            consolidation: { memory_nodes_updated: 5 },
            morning_brief: { digest_ready: true },
          },
        };
      }
      if (name === 'get_wake_context') {
        return {
          agent_id: args.agent_id,
          active_constraints: [
            { type: 'error_pattern', content: 'Solidity compilation requires explicit pragma 0.8.26' },
            { type: 'rule', content: 'Prefer compact token summaries on large research loops' },
          ],
          daily_digest: 'Consolidated 2 execution traces with 1 critical compilation fix.',
          system_prompt_injection: 'CRITICAL CONSTRAINTS:\n- Solidity compilation requires explicit pragma 0.8.26',
          skills_count: 3,
          memories_count: 12,
        };
      }
      return {};
    });

    // 4. One-click Portal setup: no browser-supplied agent key or bearer token.
    const setupRes = await request(app)
      .post(`/v1/agents/${agentId}/dream/setup`).send({});
    expect(setupRes.status).toBe(201);
    expect(setupRes.body.ok).toBe(true);
    expect(setupRes.body.setup_mode).toBe('portal_managed');
    expect(setupRes.body.link.hypermove_agent_id).toBe(agentId);

    // 5. Trigger start_dream
    const triggerRes = await request(app)
      .post(`/v1/agents/${agentId}/dream/trigger`)
      .send({ preset: 'balanced', budget_usd: 0.1 });
    expect(triggerRes.status).toBe(202);
    expect(triggerRes.body.ok).toBe(true);
    expect(triggerRes.body.run.status).toBe('completed');
    expect(triggerRes.body.run.result.stage_summaries.extraction.constraints_extracted).toBe(2);

    // Verify submit_episode_log converted telemetry
    const submitCall = hyperMoveCalls.find((c) => c.name === 'submit_episode_log');
    expect(submitCall).toBeDefined();
    expect(submitCall?.token).toBe('openx-server-managed-hypermove-token');
    expect(submitCall?.args.episodes).toHaveLength(2);
    expect(submitCall?.args.episodes[0].outcome).toBe('failure');
    expect(submitCall?.args.episodes[1].outcome).toBe('success');

    // 6. Query wake context & effective constraints overlay
    const lesson = dreamState.addLesson(agentId, 'Verify pragma statements before compiling Solidity contracts.');
    dreamState.resolveLesson(agentId, lesson.id, 'PROMOTED_CONSTRAINT');

    const wakeRes = await request(app)
      .get(`/v1/agents/${agentId}/wake`);
    expect(wakeRes.status).toBe(200);
    expect(wakeRes.body.ok).toBe(true);
    expect(wakeRes.body.upstream.active_constraints).toHaveLength(2);
    expect(wakeRes.body.openx_constraints).toHaveLength(1);
    expect(wakeRes.body.effective_constraints).toHaveLength(3);
  });
});
