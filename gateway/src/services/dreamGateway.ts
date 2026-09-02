import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

export type DreamRunStatus = 'payment_required' | 'running' | 'completed' | 'failed';

export interface DreamLink { openx_agent_id: string; hypermove_agent_id: string; linked_at: string; }
export interface DreamSettlement { status: 'settled' | 'failed'; quote_id: string; transaction_hash?: string; amount: string; currency: 'RLUSD'; destination: string; attempted_at: string; reason?: string; }
export interface LearningBrief { generated_at: string; stage_summaries?: Record<string, unknown>; morning_brief?: string; constraints_count: number; }
export interface DreamReconciliation { last_checked_at: string; upstream_status?: string; last_error?: string; }
export interface DreamRun { id: string; openx_agent_id: string; hypermove_agent_id: string; status: DreamRunStatus; preset: 'frugal' | 'balanced' | 'thorough'; budget_usd: number; created_at: string; completed_at?: string; result?: unknown; error?: string; quote?: unknown; settlement?: DreamSettlement; learning_brief?: LearningBrief; reconciliation?: DreamReconciliation; source?: 'gateway' | 'hypermove_sync'; upstream_fingerprint?: string; }
export interface ManagedLesson { id: string; openx_agent_id: string; run_id?: string; state: 'UNREVIEWED' | 'IN_REVIEW' | 'PROMOTED_CONSTRAINT' | 'QUARANTINED' | 'REJECTED'; content: string; source: 'manual' | 'dream_cycle'; created_at: string; resolved_at?: string; }

interface EncryptedSecret { iv: string; tag: string; ciphertext: string; }
export interface CachedWakeContext { upstream: unknown; cached_at: string; }
interface DreamState { links: DreamLink[]; runs: DreamRun[]; lessons: ManagedLesson[]; credentials: Record<string, EncryptedSecret>; settled_quotes: string[]; settled_transactions: string[]; wake_contexts?: Record<string, CachedWakeContext>; }
const emptyState = (): DreamState => ({ links: [], runs: [], lessons: [], credentials: {}, settled_quotes: [], settled_transactions: [], wake_contexts: {} });

export class DreamStateStore {
  private state: DreamState;
  constructor(private readonly filePath = process.env.OPENX_DREAM_STATE_PATH, private readonly encryptionKey = process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY) { this.state = this.load(); }
  link(openxAgentId: string, hypermoveAgentId: string): DreamLink {
    const link = { openx_agent_id: openxAgentId, hypermove_agent_id: hypermoveAgentId, linked_at: new Date().toISOString() };
    this.state.links = [...this.state.links.filter((item) => item.openx_agent_id !== openxAgentId), link]; this.persist(); return link;
  }
  getLink(openxAgentId: string) { return this.state.links.find((item) => item.openx_agent_id === openxAgentId); }
  createRun(openxAgentId: string, link: DreamLink, preset: DreamRun['preset'], budgetUsd: number) {
    const run: DreamRun = { id: randomUUID(), openx_agent_id: openxAgentId, hypermove_agent_id: link.hypermove_agent_id, status: 'running', preset, budget_usd: budgetUsd, created_at: new Date().toISOString(), source: 'gateway' };
    this.state.runs.unshift(run); this.persist(); return run;
  }
  importCompletedRun(openxAgentId: string, link: DreamLink, result: unknown, learningBrief: LearningBrief, upstreamFingerprint: string): { run: DreamRun; created: boolean } {
    const existing = this.state.runs.find((item) => item.openx_agent_id === openxAgentId && item.source === 'hypermove_sync' && item.upstream_fingerprint === upstreamFingerprint);
    const reconciliation: DreamReconciliation = { last_checked_at: new Date().toISOString(), upstream_status: 'completed' };
    if (existing) {
      Object.assign(existing, { result, learning_brief: learningBrief, reconciliation });
      this.state.runs = [existing, ...this.state.runs.filter((item) => item.id !== existing.id)];
      this.persist();
      return { run: existing, created: false };
    }
    const now = new Date().toISOString();
    const run: DreamRun = {
      id: randomUUID(), openx_agent_id: openxAgentId, hypermove_agent_id: link.hypermove_agent_id,
      status: 'completed', preset: 'balanced', budget_usd: 0, created_at: now, completed_at: now,
      result, learning_brief: learningBrief, reconciliation, source: 'hypermove_sync', upstream_fingerprint: upstreamFingerprint,
    };
    this.state.runs.unshift(run); this.persist();
    return { run, created: true };
  }
  updateRun(id: string, patch: Partial<DreamRun>) { const run = this.state.runs.find((item) => item.id === id); if (!run) return undefined; Object.assign(run, patch); this.persist(); return run; }
  getRun(id: string) { return this.state.runs.find((item) => item.id === id); }
  latestRun(openxAgentId: string) {
    const runs = this.state.runs.filter((item) => item.openx_agent_id === openxAgentId);
    if (!runs.length) return undefined;
    // Prefer active running or completed runs over expired/abandoned payment_required runs
    const nonExpiredRuns = runs.filter((r) => {
      if (r.status !== 'payment_required') return true;
      const quoteExpires = (r.quote as any)?.payment?.expiresAt || (r.quote as any)?.expires_at;
      if (quoteExpires && Date.parse(quoteExpires) < Date.now()) return false;
      const createdTime = Date.parse(r.created_at || '1970-01-01');
      if (Date.now() - createdTime > 15 * 60 * 1000) return false;
      return true;
    });
    const candidates = nonExpiredRuns.length > 0 ? nonExpiredRuns : runs;
    return candidates.slice().sort((a, b) => {
      const timeA = Date.parse(a.completed_at || a.created_at || '1970-01-01');
      const timeB = Date.parse(b.completed_at || b.created_at || '1970-01-01');
      return timeB - timeA;
    })[0];
  }
  listRuns(openxAgentId: string) { return this.state.runs.filter((item) => item.openx_agent_id === openxAgentId); }
  runningRuns() { return this.state.runs.filter((item) => item.status === 'running'); }
  listLessons(openxAgentId: string) { return this.state.lessons.filter((item) => item.openx_agent_id === openxAgentId); }
  addLesson(openxAgentId: string, content: string, source: ManagedLesson['source'] = 'manual', runId?: string) { const normalized = content.trim(); const existing = this.state.lessons.find((item) => item.openx_agent_id === openxAgentId && item.run_id === runId && item.content === normalized); if (existing) return existing; const lesson: ManagedLesson = { id: randomUUID(), openx_agent_id: openxAgentId, ...(runId ? { run_id: runId } : {}), content: normalized, source, state: 'UNREVIEWED', created_at: new Date().toISOString() }; this.state.lessons.unshift(lesson); this.persist(); return lesson; }
  cacheWakeContext(openxAgentId: string, upstream: unknown): CachedWakeContext { const cached = { upstream, cached_at: new Date().toISOString() }; this.state.wake_contexts = { ...(this.state.wake_contexts || {}), [openxAgentId]: cached }; this.persist(); return cached; }
  getCachedWakeContext(openxAgentId: string): CachedWakeContext | undefined { return this.state.wake_contexts?.[openxAgentId]; }
  claimSettlement(quoteId: string, transactionHash: string): boolean { if (this.state.settled_quotes.includes(quoteId) || this.state.settled_transactions.includes(transactionHash)) return false; this.state.settled_quotes.push(quoteId); this.state.settled_transactions.push(transactionHash); this.persist(); return true; }
  resolveLesson(openxAgentId: string, lessonId: string, state: ManagedLesson['state']) { const lesson = this.state.lessons.find((item) => item.openx_agent_id === openxAgentId && item.id === lessonId); if (!lesson) return undefined; lesson.state = state; lesson.resolved_at = new Date().toISOString(); this.persist(); return lesson; }
  setMcpToken(agentId: string, token: string): void { this.state.credentials[agentId] = this.encrypt(token); this.persist(); }
  hasMcpToken(agentId: string): boolean { return Boolean(this.state.credentials[agentId]); }
  isTokenVaultConfigured(): boolean { try { this.key(); return true; } catch { return false; } }
  getMcpToken(agentId: string): string | undefined { const value = this.state.credentials[agentId]; return value ? this.decrypt(value) : undefined; }
  private key(): Buffer { const raw = this.encryptionKey || process.env.OPENX_DREAM_TOKEN_ENCRYPTION_KEY; if (!raw) throw new McpError(503, { error: 'token_vault_unconfigured', message: 'OPENX_DREAM_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key' }); const key = Buffer.from(raw, 'base64'); if (key.length !== 32) throw new McpError(503, { error: 'token_vault_unconfigured', message: 'OPENX_DREAM_TOKEN_ENCRYPTION_KEY must decode to 32 bytes' }); return key; }
  private encrypt(token: string): EncryptedSecret { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key(), iv); const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]); return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }; }
  private decrypt(value: EncryptedSecret): string { const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(value.iv, 'base64')); decipher.setAuthTag(Buffer.from(value.tag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8'); }
  private load(): DreamState {
    if (!this.filePath) {
      const persisted = gatewayDatabase.read<DreamState | null>('dream_state', null);
      if (persisted) return { ...emptyState(), ...persisted };
      const legacyPath = resolve('.openx/dream-state.json');
      if (!existsSync(legacyPath)) return emptyState();
      try { const migrated = { ...emptyState(), ...JSON.parse(readFileSync(legacyPath, 'utf8')) as DreamState }; gatewayDatabase.write('dream_state', migrated); return migrated; } catch { return emptyState(); }
    }
    if (!existsSync(this.filePath)) return emptyState();
    try { return { ...emptyState(), ...JSON.parse(readFileSync(this.filePath, 'utf8')) as DreamState }; } catch { return emptyState(); }
  }
  private persist() { if (!this.filePath) { gatewayDatabase.write('dream_state', this.state); return; } mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 }); const temporary = `${this.filePath}.${randomUUID()}.tmp`; writeFileSync(temporary, JSON.stringify(this.state, null, 2), { encoding: 'utf8', mode: 0o600 }); renameSync(temporary, this.filePath); }
}

export class McpError extends Error { constructor(public readonly status: number, public readonly data: unknown) { super('HyperMove MCP request failed'); } }
export class HyperMoveClient {
  async call(name: string, args: Record<string, unknown>, token?: string, extraHeaders: Record<string, string> = {}): Promise<any> {
    const url = process.env.HYPERMOVE_MCP_URL; if (!url) throw new McpError(503, { error: 'hypermove_unavailable', message: 'HYPERMOVE_MCP_URL is not configured' });
    if (!token) throw new McpError(409, { error: 'mcp_token_not_configured', message: 'Store a HyperMove bearer token for this agent before using Dream Cycle' });
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, ...extraHeaders }, body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'tools/call', params: { name, arguments: args } }) });
    const raw = await response.text();
    let bodyJson: string = raw;
    if (response.headers.get('content-type')?.includes('text/event-stream') || raw.startsWith('event:')) {
      const dataLines = raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
      if (dataLines.length > 0) bodyJson = dataLines[dataLines.length - 1];
    }
    let body: any = {};
    try { body = JSON.parse(bodyJson); } catch { body = {}; }
    if (!response.ok || body.error) throw new McpError(response.status || 502, body.error || body);
    const result = body.result ?? body;
    const text = result?.content?.find?.((item: any) => item.type === 'text')?.text;
    let parsed: any = result;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    if (result?.isError || (parsed && typeof parsed === 'object' && (parsed.error === 'payment_required' || parsed.code === -32402))) {
      const is402 = parsed?.error === 'payment_required' || parsed?.code === -32402;
      throw new McpError(is402 ? 402 : 400, parsed?.data || parsed);
    }
    return parsed;
  }
}

export const dreamState = new DreamStateStore();
export const hyperMove = new HyperMoveClient();
