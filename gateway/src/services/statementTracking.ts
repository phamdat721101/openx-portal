import { createHash, randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

export type StatementStatus = 'received' | 'partial' | 'failed';
export type AttestationStatus = 'pending' | 'verified' | 'unavailable_source_chain' | 'failed';
export interface StatementInput {
  report_id: string; content_hash: string; visibility: 'private' | 'public'; source_chain: string;
  source_block: string; source_timestamp: string; finality: 'finalized' | 'pending'; wallet_address?: string;
  venue: string; collateral_usd: number; debt_usd: number; realized_pnl_usd?: number; unrealized_pnl_usd?: number;
  pnl_methodology: string; status?: StatementStatus; summary?: string; attestation?: { status: AttestationStatus; chain?: string; receipt?: string };
}
export interface StatementRecord extends StatementInput { agent_id: string; id: string; ltv: number; recommended_ltv: number; max_ltv: number; status: StatementStatus; attestation: { status: AttestationStatus; chain?: string; receipt?: string }; created_at: string; updated_at: string; }

const now = () => new Date().toISOString();
export class StatementTracking {
  constructor() {
    gatewayDatabase.raw().exec(`CREATE TABLE IF NOT EXISTS statement_reports (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, report_id TEXT NOT NULL, content_hash TEXT NOT NULL,
      visibility TEXT NOT NULL, source_chain TEXT NOT NULL, source_block TEXT NOT NULL, source_timestamp TEXT NOT NULL,
      finality TEXT NOT NULL, wallet_address TEXT, venue TEXT NOT NULL, collateral_usd REAL NOT NULL, debt_usd REAL NOT NULL,
      realized_pnl_usd REAL, unrealized_pnl_usd REAL, pnl_methodology TEXT NOT NULL, status TEXT NOT NULL,
      attestation_json TEXT NOT NULL, summary TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(agent_id, report_id, content_hash));
      CREATE INDEX IF NOT EXISTS statement_reports_agent_updated ON statement_reports(agent_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS statement_reports_public_rank ON statement_reports(visibility, realized_pnl_usd DESC, updated_at DESC);`);
  }
  private row(row: Record<string, unknown>): StatementRecord {
    const collateral = Number(row.collateral_usd); const debt = Number(row.debt_usd);
    return { ...(row as unknown as StatementInput), id: String(row.id), agent_id: String(row.agent_id), collateral_usd: collateral, debt_usd: debt,
      ltv: collateral > 0 ? debt / collateral : 0, recommended_ltv: .32, max_ltv: .4, status: row.status as StatementStatus,
      attestation: JSON.parse(String(row.attestation_json)) as StatementRecord['attestation'], created_at: String(row.created_at), updated_at: String(row.updated_at) };
  }
  public ingest(agentId: string, input: StatementInput): { record: StatementRecord; created: boolean } {
    const db = gatewayDatabase.raw(); const existing = db.prepare('SELECT * FROM statement_reports WHERE agent_id=? AND report_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId, input.report_id) as Record<string, unknown> | undefined;
    if (existing && String(existing.content_hash) !== input.content_hash) throw new Error('statement_report_hash_conflict');
    if (existing) return { record: this.row(existing), created: false };
    const timestamp = now(); const id = randomUUID(); const attestation = input.attestation || { status: 'pending' as const };
    db.prepare(`INSERT INTO statement_reports (id,agent_id,report_id,content_hash,visibility,source_chain,source_block,source_timestamp,finality,wallet_address,venue,collateral_usd,debt_usd,realized_pnl_usd,unrealized_pnl_usd,pnl_methodology,status,attestation_json,summary,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, agentId, input.report_id, input.content_hash, input.visibility, input.source_chain, input.source_block, input.source_timestamp, input.finality, input.wallet_address || null, input.venue, input.collateral_usd, input.debt_usd, input.realized_pnl_usd ?? null, input.unrealized_pnl_usd ?? null, input.pnl_methodology, input.status || 'received', JSON.stringify(attestation), input.summary || null, timestamp, timestamp);
    return { record: this.row(db.prepare('SELECT * FROM statement_reports WHERE id=?').get(id) as Record<string, unknown>), created: true };
  }
  public latest(agentId: string): StatementRecord | undefined { const row = gatewayDatabase.raw().prepare('SELECT * FROM statement_reports WHERE agent_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId) as Record<string, unknown> | undefined; return row && this.row(row); }
  public leaderboard(limit = 25): StatementRecord[] { return (gatewayDatabase.raw().prepare("SELECT * FROM statement_reports WHERE visibility='public' AND status IN ('received','partial') ORDER BY COALESCE(realized_pnl_usd, unrealized_pnl_usd, 0) DESC LIMIT ?").all(Math.max(1, Math.min(limit, 100))) as Record<string, unknown>[]).map((row) => this.row(row)); }
}
export const statementTracking = new StatementTracking();
export const statementHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
