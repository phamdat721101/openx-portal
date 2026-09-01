import { createHash } from 'node:crypto';
import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import { gatewayDatabase } from '../db/database.js';

export type KnowledgeSource = 'agent_profile' | 'telemetry' | 'memory_episode' | 'skill_metadata' | 'usage_summary' | 'dream_run' | 'lesson' | 'audit';
export type ArchiveState = 'pending' | 'uploading' | 'uploaded' | 'retrying' | 'failed';
export type SyncState = 'queued' | 'collecting' | 'uploading' | 'complete' | 'degraded';

export interface KnowledgeInput { source_type: KnowledgeSource; source_id: string; payload: unknown; }
export interface KnowledgeSync { agent_id: string; state: SyncState; total_records: number; uploaded_records: number; pending_records: number; failed_records: number; source_counts: Record<string, number>; updated_at: string; safe_error?: string; }
export interface KnowledgeRecordDetail { agent_id: string; source_type: KnowledgeSource; source_id: string; content_hash: string; state: ArchiveState; root_hash: string | null; transaction_hash: string | null; message: string; data: unknown; updated_at: string; }

interface ArchiveRow { id: string; agent_id: string; source_type: KnowledgeSource; source_id: string; content_hash: string; sanitized_json: string; state: ArchiveState; root_hash: string | null; transaction_hash: string | null; attempts: number; next_attempt_at: string | null; safe_error: string | null; created_at: string; updated_at: string; }

const SECRET_KEY = /(^|_)(token|secret|password|authorization|cookie|private_?key|seed|agent_?key|credential)(_|$)/i;
const SECRET_VALUE = /(bearer\s+[\w.-]+|0x[a-fA-F0-9]{64}|(?:api[_-]?key|token|secret)\s*[:=]\s*[^\s,]+)/gi;
const PII_VALUE = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\+?\d[\d\s().-]{7,}\d/g;
const stable = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const cleanText = (value: string) => value.replace(SECRET_VALUE, '[redacted-secret]').replace(PII_VALUE, '[redacted-personal-data]');
const sanitize = (value: unknown, key = ''): unknown => {
  if (SECRET_KEY.test(key)) return '[redacted-secret]';
  if (key === 'code_template') return '[redacted-code-template]';
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
  return value;
};
const now = () => new Date().toISOString();

/** Gateway-only immutable archive. It remains inert until all 0G bindings are present. */
export class AgentKnowledgeArchive {
  private indexer?: Indexer;

  constructor() {
    gatewayDatabase.raw().exec(`
      CREATE TABLE IF NOT EXISTS agent_knowledge_records (
        id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
        content_hash TEXT NOT NULL, sanitized_json TEXT NOT NULL, state TEXT NOT NULL,
        root_hash TEXT, transaction_hash TEXT, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT, safe_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(agent_id, source_type, source_id, content_hash)
      );
      CREATE INDEX IF NOT EXISTS agent_knowledge_agent_state ON agent_knowledge_records(agent_id, state, updated_at DESC);
    `);
  }

  public health(): { state: 'disabled' | 'ready' | 'misconfigured'; reason?: string } {
    const config = this.config();
    if (!config.enabled) return { state: 'disabled' };
    if (!config.rpcUrl || !config.indexerUrl || !config.uploadKey || !config.recipientPubKey || !config.decryptionKey) return { state: 'misconfigured', reason: 'Missing required 0G Storage Gateway binding.' };
    const recipient = config.recipientPubKey.replace(/^0x/, '');
    if (!/^[0-9a-f]+$/i.test(recipient) || (recipient.length !== 66 && recipient.length !== 130)) return { state: 'misconfigured', reason: '0G ECIES recipient public key must be a 33- or 65-byte secp256k1 key.' };
    return { state: 'ready' };
  }

  public sync(agentId: string, inputs: KnowledgeInput[]): KnowledgeSync {
    const db = gatewayDatabase.raw();
    for (const input of inputs) this.enqueue(agentId, input);
    void this.processPending(agentId);
    return this.status(agentId);
  }

  public enqueue(agentId: string, input: KnowledgeInput): void {
    const payload = sanitize(input.payload);
    const sanitizedJson = stable({ schema_version: 1, agent_id: agentId, source_type: input.source_type, source_id: input.source_id, payload });
    const contentHash = createHash('sha256').update(sanitizedJson).digest('hex');
    const timestamp = now();
    gatewayDatabase.raw().prepare(`INSERT OR IGNORE INTO agent_knowledge_records
      (id, agent_id, source_type, source_id, content_hash, sanitized_json, state, root_hash, transaction_hash, attempts, next_attempt_at, safe_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, 0, NULL, NULL, ?, ?)`)
      .run(`${agentId}:${input.source_type}:${input.source_id}:${contentHash}`, agentId, input.source_type, input.source_id, contentHash, sanitizedJson, timestamp, timestamp);
  }

  public status(agentId: string): KnowledgeSync {
    const rows = gatewayDatabase.raw().prepare('SELECT state, source_type, COUNT(*) AS count FROM agent_knowledge_records WHERE agent_id = ? GROUP BY state, source_type').all(agentId) as Array<{ state: ArchiveState; source_type: string; count: number }>;
    const source_counts: Record<string, number> = {}; let total = 0; let uploaded = 0; let pending = 0; let failed = 0;
    for (const row of rows) { total += row.count; source_counts[row.source_type] = (source_counts[row.source_type] || 0) + row.count; if (row.state === 'uploaded') uploaded += row.count; if (row.state === 'pending' || row.state === 'uploading' || row.state === 'retrying') pending += row.count; if (row.state === 'failed') failed += row.count; }
    const health = this.health();
    return { agent_id: agentId, state: health.state === 'misconfigured' ? 'degraded' : pending ? 'uploading' : 'complete', total_records: total, uploaded_records: uploaded, pending_records: pending, failed_records: failed, source_counts, updated_at: now(), ...(health.state === 'misconfigured' ? { safe_error: health.reason } : {}) };
  }

  public async processPending(agentId?: string): Promise<number> {
    if (this.health().state !== 'ready') return 0;
    const db = gatewayDatabase.raw();
    const rows = db.prepare(`SELECT * FROM agent_knowledge_records WHERE state IN ('pending', 'retrying') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ${agentId ? 'AND agent_id = ?' : ''} ORDER BY created_at ASC LIMIT 10`).all(...(agentId ? [now(), agentId] : [now()])) as ArchiveRow[];
    for (const row of rows) await this.upload(row);
    return rows.length;
  }

  /** Drains due records so an operator receives persisted 0G transaction results. */
  public async flush(agentId?: string): Promise<void> {
    while (await this.processPending(agentId)) { /* uploads either persist or become retry-scheduled */ }
  }

  /** Explicit operator recovery after a corrected storage binding; never runs without an authenticated admin request. */
  public retryPending(agentId?: string): number {
    const where = agentId ? 'AND agent_id = ?' : '';
    return gatewayDatabase.raw().prepare(`UPDATE agent_knowledge_records SET state = 'pending', next_attempt_at = NULL, safe_error = NULL, updated_at = ? WHERE state IN ('retrying', 'failed', 'uploading') ${where}`).run(now(), ...(agentId ? [agentId] : [])).changes;
  }

  /** Admin-only callers may inspect the already-sanitized payload persisted for each archive record. */
  public records(agentId: string): KnowledgeRecordDetail[] {
    const rows = gatewayDatabase.raw().prepare('SELECT * FROM agent_knowledge_records WHERE agent_id = ? ORDER BY created_at ASC').all(agentId) as ArchiveRow[];
    return rows.map((row) => ({
      agent_id: row.agent_id,
      source_type: row.source_type,
      source_id: row.source_id,
      content_hash: row.content_hash,
      state: row.state,
      root_hash: row.root_hash,
      transaction_hash: row.transaction_hash,
      message: row.safe_error || (row.state === 'uploaded' ? 'Published to 0G Storage.' : 'Awaiting 0G Storage publication.'),
      data: JSON.parse(row.sanitized_json),
      updated_at: row.updated_at,
    }));
  }

  /** Retrieves only sanitized, proof-verified records for public auditor grounding. */
  public async retrieve(agentId: string, query: string, limit = 6): Promise<Array<{ id: string; source_type: KnowledgeSource; root_hash: string; excerpt: string; payload: unknown }>> {
    if (this.health().state !== 'ready') return [];
    const words = query.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    const rows = gatewayDatabase.raw().prepare("SELECT * FROM agent_knowledge_records WHERE agent_id = ? AND state = 'uploaded' ORDER BY updated_at DESC LIMIT 80").all(agentId) as ArchiveRow[];
    const selected = rows.map((row) => ({ row, score: words.reduce((score, word) => score + (row.sanitized_json.toLowerCase().includes(word) ? 1 : 0), 0) }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 8)));
    const { indexer } = this.client(); const results: Array<{ id: string; source_type: KnowledgeSource; root_hash: string; excerpt: string; payload: unknown }> = [];
    for (const { row } of selected) {
      if (!row.root_hash) continue;
      try {
        const [blob, error] = await indexer.downloadToBlob(row.root_hash, { proof: true, decryption: { privateKey: this.config().decryptionKey! } });
        if (error) throw error;
        const text = await blob.text();
        if (text !== row.sanitized_json) throw new Error('Downloaded 0G archive did not match persisted content hash.');
        const parsed = JSON.parse(text) as { payload?: unknown };
        results.push({ id: row.id, source_type: row.source_type, root_hash: row.root_hash, excerpt: text.slice(0, 280), payload: parsed.payload ?? null });
      } catch {
        // A proof/decryption failure removes the record from model context; never fall back to unverified data.
      }
    }
    return results;
  }

  private client(): { indexer: Indexer; signer: ethers.Wallet } {
    const config = this.config();
    if (!this.indexer) this.indexer = new Indexer(config.indexerUrl!);
    return { indexer: this.indexer, signer: new ethers.Wallet(config.uploadKey!, new ethers.JsonRpcProvider(config.rpcUrl!)) };
  }

  private config() {
    return {
      enabled: process.env.ZEROG_STORAGE_ENABLED === 'true',
      rpcUrl: process.env.ZEROG_STORAGE_RPC_URL?.trim(),
      indexerUrl: process.env.ZEROG_STORAGE_INDEXER_RPC_URL?.trim(),
      uploadKey: process.env.ZEROG_STORAGE_UPLOAD_PRIVATE_KEY?.trim(),
      recipientPubKey: process.env.ZEROG_STORAGE_ENCRYPTION_PUBLIC_KEY?.trim(),
      decryptionKey: process.env.ZEROG_STORAGE_DECRYPTION_PRIVATE_KEY?.trim(),
    };
  }

  private async upload(row: ArchiveRow): Promise<void> {
    const db = gatewayDatabase.raw(); const timestamp = now();
    db.prepare("UPDATE agent_knowledge_records SET state = 'uploading', attempts = attempts + 1, updated_at = ? WHERE id = ?").run(timestamp, row.id);
    try {
      const { indexer, signer } = this.client();
      const data = new MemData(new TextEncoder().encode(row.sanitized_json));
      const [, treeError] = await data.merkleTree(); if (treeError) throw treeError;
      const [transaction, uploadError] = await indexer.upload(data, this.config().rpcUrl!, signer, { encryption: { type: 'ecies', recipientPubKey: this.config().recipientPubKey! } });
      if (uploadError) throw uploadError;
      if (!('rootHash' in transaction)) throw new Error('Fragmented 0G archive response is not supported for bounded knowledge records.');
      const receipt = await signer.provider!.waitForTransaction(transaction.txHash, 1, 120_000);
      if (!receipt || receipt.status !== 1) throw new Error('0G storage upload transaction was not confirmed successfully.');
      db.prepare("UPDATE agent_knowledge_records SET state = 'uploaded', root_hash = ?, transaction_hash = ?, next_attempt_at = NULL, safe_error = NULL, updated_at = ? WHERE id = ?").run(transaction.rootHash, transaction.txHash, now(), row.id);
    } catch (error) {
      const attempts = row.attempts + 1; const terminal = attempts >= Number(process.env.ZEROG_STORAGE_RETRY_LIMIT || 5);
      const delay = Math.min(60 * 60_000, 1_000 * 2 ** Math.min(attempts, 8)); const safe = error instanceof Error ? error.message.replace(/0x[a-fA-F0-9]{64}/g, '[redacted]').slice(0, 240) : '0G upload failed';
      db.prepare("UPDATE agent_knowledge_records SET state = ?, next_attempt_at = ?, safe_error = ?, updated_at = ? WHERE id = ?").run(terminal ? 'failed' : 'retrying', terminal ? null : new Date(Date.now() + delay).toISOString(), safe, now(), row.id);
    }
  }
}

export const agentKnowledgeArchive = new AgentKnowledgeArchive();
