import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { auditorService } from '../src/services/auditorService.js';
import { dreamState } from '../src/services/dreamGateway.js';

process.env.NODE_ENV = 'test';
const { app } = await import('../src/server.js');

describe('wallet and advisory auditor APIs', () => {
  // seam:terminal-audit-trigger
  // seam:dream-review-queue
  // seam:compute-review-contract
  // seam:candidate-skill-lifecycle
  // seam:workspace-event-stream
  // seam:evidence-cited-chat
  it('returns an explicit unlinked-wallet state and records evidence-only audit findings', async () => {
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Audited Agent', host_type: 'custom' });
    expect(registration.status).toBe(201);
    const agentId = registration.body.agent.agent_id as string;

    const wallet = await request(app).get(`/v1/agents/${agentId}/wallet`);
    expect(wallet.status).toBe(200);
    expect(wallet.body.wallet).toMatchObject({ address: null, chain_id: 49986, network: 'Status Network Testnet' });
    expect(wallet.body.wallet.source_errors).toContain('wallet_not_linked');

    const telemetry = await request(app).post('/v1/agent/telemetry').send({ agent_id: agentId, task_id: 'audit-task', model: 'test-model', status: 'success', task_state: 'completed' });
    expect(telemetry.status).toBe(201);

    const audits = await request(app).get(`/v1/agents/${agentId}/audits`);
    expect(audits.status).toBe(200);
    expect(audits.body.audits[0].findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimension: 'task_reliability', verdict: 'insufficient_evidence' }),
      expect.objectContaining({ dimension: 'lesson_quality', verdict: 'insufficient_evidence' }),
    ]));
  });

  it('processes a completed Dream run through the 0G review contract and stores an advisory skill candidate', async () => {
    const original = {
      enabled: process.env.ZEROG_COMPUTE_ENABLED,
      url: process.env.ZEROG_COMPUTE_API_URL,
      key: process.env.ZEROG_COMPUTE_API_KEY,
      model: process.env.ZEROG_COMPUTE_MODEL,
    };
    process.env.ZEROG_COMPUTE_ENABLED = 'true';
    process.env.ZEROG_COMPUTE_API_URL = 'https://compute.test.invalid/v1/chat/completions';
    process.env.ZEROG_COMPUTE_API_KEY = 'test-0g-key';
    process.env.ZEROG_COMPUTE_MODEL = 'test-auditor-model';

    const registration = await request(app).post('/v1/agent/register').send({ display_name: '0G Audit Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id as string;
    const link = dreamState.link(agentId, agentId);
    const run = dreamState.createRun(agentId, link, 'balanced', 0.1);
    dreamState.updateRun(run.id, { status: 'completed', learning_brief: { generated_at: new Date().toISOString(), constraints_count: 1 } });
    const lesson = dreamState.addLesson(agentId, 'Verify the evidence before promoting a candidate skill.', 'dream_cycle', run.id);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        lesson_reviews: [{ lesson_id: lesson.id, verdict: 'keep', rationale: 'The lesson is evidence-bound.', evidence: ['lesson content'] }],
        skill_candidate: { skill_slug: 'evidence-review', display_name: 'Evidence Review', capability_ids: ['auditor.review'], rationale: 'Candidate only; requires human approval.' },
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    try {
      const queued = auditorService.queueDreamAudit(agentId, run.id);
      const processed = await auditorService.processDreamAudit(queued.id);
      expect(processed).toMatchObject({ status: 'completed', review: { model: 'test-auditor-model' } });
      expect(processed?.review?.lesson_reviews).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith('https://compute.test.invalid/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
      const skills = await request(app).get(`/v1/agents/${agentId}/skills`);
      expect(skills.body.skills).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'evidence-review', status: 'in_audit' })]));
    } finally {
      fetchMock.mockRestore();
      const restore = (key: string, value: string | undefined): void => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
      restore('ZEROG_COMPUTE_ENABLED', original.enabled);
      restore('ZEROG_COMPUTE_API_URL', original.url);
      restore('ZEROG_COMPUTE_API_KEY', original.key);
      restore('ZEROG_COMPUTE_MODEL', original.model);
    }
  });

  it('serves persisted workspace events and evidence-cited public auditor answers', async () => {
    const original = { enabled: process.env.ZEROG_COMPUTE_ENABLED, url: process.env.ZEROG_COMPUTE_API_URL, key: process.env.ZEROG_COMPUTE_API_KEY, model: process.env.ZEROG_COMPUTE_MODEL };
    process.env.ZEROG_COMPUTE_ENABLED = 'true'; process.env.ZEROG_COMPUTE_API_URL = 'https://compute.test.invalid/v1/chat/completions'; process.env.ZEROG_COMPUTE_API_KEY = 'test-0g-key'; process.env.ZEROG_COMPUTE_MODEL = 'test-auditor-model';
    const registration = await request(app).post('/v1/agent/register').send({ display_name: 'Workspace Agent', host_type: 'custom' });
    const agentId = registration.body.agent.agent_id as string; const link = dreamState.link(agentId, agentId); const run = dreamState.createRun(agentId, link, 'balanced', 0.1);
    dreamState.updateRun(run.id, { status: 'completed', learning_brief: { generated_at: new Date().toISOString(), constraints_count: 1 } });
    const lesson = dreamState.addLesson(agentId, 'Keep claims tied to recorded evidence.', 'dream_cycle', run.id);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ lesson_reviews: [{ lesson_id: lesson.id, verdict: 'keep', rationale: 'It limits claims.', evidence: ['Recorded evidence'] }] }) } }] }), { status: 200 }));
    try {
      const job = auditorService.queueDreamAudit(agentId, run.id); await auditorService.processDreamAudit(job.id);
      const workspace = await request(app).get(`/v1/agents/${agentId}/audits/${job.id}/workspace`);
      expect(workspace.status).toBe(200); expect(workspace.body.workspace.events.map((event: { phase: string }) => event.phase)).toContain('completed');
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'The lesson was kept because it limits claims to recorded evidence.', confidence: 'high', citations: [{ lesson_id: lesson.id }] }) } }] }), { status: 200 }));
      const chat = await request(app).post(`/v1/agents/${agentId}/audits/${job.id}/chat`).send({ message: 'Why was this lesson kept?', client_request_id: 'workspace-chat-1' });
      expect(chat.status).toBe(201); expect(chat.body.turn).toMatchObject({ role: 'auditor', confidence: 'high' }); expect(chat.body.turn.citations).toEqual(expect.arrayContaining([expect.objectContaining({ id: lesson.id, label: expect.any(String), excerpt: lesson.content })]));
      const laterRun = dreamState.createRun(agentId, link, 'balanced', 0.1); dreamState.updateRun(laterRun.id, { status: 'completed' });
      const laterJob = auditorService.queueDreamAudit(agentId, laterRun.id);
      const fallbackWorkspace = await request(app).get(`/v1/agents/${agentId}/audits/${laterJob.id}/workspace`);
      expect(fallbackWorkspace.body.workspace).toMatchObject({ lesson_scope: 'agent' }); expect(fallbackWorkspace.body.workspace.lessons).toEqual(expect.arrayContaining([expect.objectContaining({ id: lesson.id })]));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: 'The agent lesson remains relevant to this audit.', confidence: 'High', citations: [{ lesson_id: lesson.id }] }) } }] }), { status: 200 }));
      const fallbackChat = await request(app).post(`/v1/agents/${agentId}/audits/${laterJob.id}/chat`).send({ message: 'What lessons apply?', client_request_id: 'workspace-chat-fallback' });
      expect(fallbackChat.status).toBe(201); expect(fallbackChat.body.turn.citations).toEqual(expect.arrayContaining([expect.objectContaining({ id: lesson.id })]));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: { type: 'text', text: 'The lesson is supported by the recorded evidence.' }, confidence: 'high', citations: [{ lesson_id: lesson.id }] }) } }] }), { status: 200 }));
      const normalizedChat = await request(app).post(`/v1/agents/${agentId}/audits/${laterJob.id}/chat`).send({ message: 'Summarize the evidence.', client_request_id: 'workspace-chat-normalized' });
      expect(normalizedChat.status).toBe(201); expect(normalizedChat.body.turn.content).toBe('The lesson is supported by the recorded evidence.');
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ answer: { unsupported: 'shape' }, confidence: 'high', citations: [{ lesson_id: lesson.id }] }) } }] }), { status: 200 }));
      const malformedChat = await request(app).post(`/v1/agents/${agentId}/audits/${laterJob.id}/chat`).send({ message: 'What failed?', client_request_id: 'workspace-chat-malformed' });
      expect(malformedChat.status).toBe(502); expect(malformedChat.body).toMatchObject({ error: 'auditor_chat_unavailable', message: 'The auditor returned an invalid answer. Please try again.' }); expect(JSON.stringify(malformedChat.body)).not.toContain('invalid_type');
    } finally {
      fetchMock.mockRestore(); const restore = (key: string, value: string | undefined): void => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
      restore('ZEROG_COMPUTE_ENABLED', original.enabled); restore('ZEROG_COMPUTE_API_URL', original.url); restore('ZEROG_COMPUTE_API_KEY', original.key); restore('ZEROG_COMPUTE_MODEL', original.model);
    }
  });
});
