import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.js';
import { gatewayDatabase } from '../src/db/database.js';
import { agentIngestionStore } from '../src/services/agentIngestionStore.js';
import { agentKnowledgeArchive } from '../src/services/agentKnowledgeArchive.js';
import { agentRegistry } from '../src/services/agentRegistry.js';
import { dreamState } from '../src/services/dreamGateway.js';

describe('connected-agent knowledge archive', () => {
  const storageEnvironment = [
    'ZEROG_STORAGE_ENABLED',
    'ZEROG_STORAGE_RPC_URL',
    'ZEROG_STORAGE_INDEXER_RPC_URL',
    'ZEROG_STORAGE_UPLOAD_PRIVATE_KEY',
    'ZEROG_STORAGE_ENCRYPTION_PUBLIC_KEY',
    'ZEROG_STORAGE_DECRYPTION_PRIVATE_KEY',
  ] as const;
  const originalStorageEnvironment = Object.fromEntries(storageEnvironment.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    process.env.ZEROG_STORAGE_ENABLED = 'false';
    for (const name of storageEnvironment.slice(1)) delete process.env[name];
    agentRegistry.clear();
    agentIngestionStore.clear();
    gatewayDatabase.raw().exec('DELETE FROM agent_knowledge_records; DELETE FROM audit_findings; DELETE FROM audit_runs;');
  });

  afterEach(() => {
    for (const name of storageEnvironment) {
      const value = originalStorageEnvironment[name];
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  it('reads 0G bindings at use time after dotenv has initialized the process', () => {
    Object.assign(process.env, {
      ZEROG_STORAGE_ENABLED: 'true',
      ZEROG_STORAGE_RPC_URL: 'https://evmrpc-testnet.0g.ai',
      ZEROG_STORAGE_INDEXER_RPC_URL: 'https://indexer-storage-testnet-turbo.0g.ai',
      ZEROG_STORAGE_UPLOAD_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      ZEROG_STORAGE_ENCRYPTION_PUBLIC_KEY: '02' + '11'.repeat(32),
      ZEROG_STORAGE_DECRYPTION_PRIVATE_KEY: '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });

    expect(agentKnowledgeArchive.health()).toEqual({ state: 'ready' });
  });

  it('creates an idempotent initial snapshot when an agent connects', async () => {
    const agentId = '11111111-1111-4111-8111-111111111111';
    const register = await request(app).post('/v1/agent/register').send({ agent_id: agentId, display_name: 'Knowledge Agent', host_type: 'custom' });
    expect(register.status).toBe(201);
    expect(register.body.knowledge_sync).toMatchObject({ agent_id: agentId, total_records: 2, pending_records: 2 });

    const restore = await request(app).post('/v1/agent/claim').send({ agent_id: agentId, agent_key: register.body.credential.agent_key });
    expect(restore.status).toBe(200);
    expect(restore.body.knowledge_sync.total_records).toBe(2);

    const status = await request(app).get(`/v1/agents/${agentId}/knowledge-sync`);
    expect(status.status).toBe(200);
    expect(status.body.sync).toMatchObject({ total_records: 2, pending_records: 2 });
    expect(status.body.storage.state).toBe('disabled');
  });

  it('sanitizes new agent evidence before placing it in the archive outbox', async () => {
    const agentId = '22222222-2222-4222-8222-222222222222';
    await request(app).post('/v1/agent/register').send({ agent_id: agentId, display_name: 'Sanitized Agent', host_type: 'custom' });
    const response = await request(app).post('/v1/agent/telemetry').send({ agent_id: agentId, task_id: 'archive-task', model: 'test', status: 'success', summary: 'authorization: Bearer private-token person@example.com' });
    expect(response.status).toBe(201);
    const row = gatewayDatabase.raw().prepare("SELECT sanitized_json FROM agent_knowledge_records WHERE agent_id = ? AND source_type = 'telemetry'").get(agentId) as { sanitized_json: string };
    expect(row.sanitized_json).toContain('[redacted-secret]');
    expect(row.sanitized_json).toContain('[redacted-personal-data]');
    expect(row.sanitized_json).not.toContain('private-token');
  });

  it('persists a canonical REM envelope separately from generic agent evidence', () => {
    const agentId = '33333333-3333-4333-8333-333333333333';
    agentKnowledgeArchive.enqueue(agentId, {
      source_type: 'lesson', source_id: 'lesson-1', archive_schema: '0g-dream-memory/v1',
      payload: { lesson_id: 'lesson-1', state: 'PROMOTED_CONSTRAINT', content: 'Never persist bearer tokens.', evidence_proof: { xrpl_payment_tx: 'ABC' } },
    });
    const row = gatewayDatabase.raw().prepare("SELECT sanitized_json FROM agent_knowledge_records WHERE agent_id = ?").get(agentId) as { sanitized_json: string };
    expect(row.sanitized_json).toContain('0g-dream-memory/v1');
    expect(row.sanitized_json).toContain('PROMOTED_CONSTRAINT');
    expect(row.sanitized_json).not.toContain('bearer token');
  });

  it('backfills historic promoted lessons through the protected REM archive endpoint', async () => {
    process.env.OPENX_DREAM_CREDENTIAL_ADMIN_TOKEN = 'test-admin-secret-token-12345';
    const agentId = '44444444-4444-4444-8444-444444444444';
    await request(app).post('/v1/agent/register').send({ agent_id: agentId, display_name: 'Historic REM Agent', host_type: 'custom' });
    const lesson = dreamState.addLesson(agentId, 'Keep signed storage receipts with the promoted constraint.');
    dreamState.resolveLesson(agentId, lesson.id, 'PROMOTED_CONSTRAINT');
    const health = vi.spyOn(agentKnowledgeArchive, 'health').mockReturnValue({ state: 'ready' });
    const processPending = vi.spyOn(agentKnowledgeArchive, 'processPending').mockResolvedValue(0);
    const flush = vi.spyOn(agentKnowledgeArchive, 'flush').mockResolvedValue();

    const unauthenticated = await request(app).post('/v1/admin/0g-rem-backfill');
    const response = await request(app).post('/v1/admin/0g-rem-backfill').set('Authorization', 'Bearer test-admin-secret-token-12345');
    const replay = await request(app).post('/v1/admin/0g-rem-backfill').set('Authorization', 'Bearer test-admin-secret-token-12345');
    const remRows = gatewayDatabase.raw().prepare("SELECT sanitized_json FROM agent_knowledge_records WHERE agent_id = ? AND sanitized_json LIKE '%0g-dream-memory/v1%'").all(agentId) as Array<{ sanitized_json: string }>;

    expect(unauthenticated.status).toBe(401);
    expect(response.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, queued_rem_lessons: 1, results: [{ agent_id: agentId, queued_rem_lessons: 1 }] });
    expect(remRows).toHaveLength(1);
    expect(remRows[0].sanitized_json).toContain(lesson.id);

    health.mockRestore();
    processPending.mockRestore();
    flush.mockRestore();
  });
});
