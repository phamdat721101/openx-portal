import { createHash, randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

export type StatementStatus = 'received' | 'partial' | 'failed';
export type AttestationStatus = 'pending' | 'verified' | 'unavailable_source_chain' | 'failed';
export interface StatementInput {
  report_id: string; content_hash: string; visibility: 'private' | 'public'; source_chain: string;
  source_block: string; source_timestamp: string; finality: 'finalized' | 'pending'; wallet_address?: string;
  venue: string; collateral_usd: number; debt_usd: number; realized_pnl_usd?: number; unrealized_pnl_usd?: number;
  pnl_methodology: string; status?: StatementStatus; summary?: string; attestation?: { status: AttestationStatus; chain?: string; receipt?: string };
  schema_version?: 'apsd-l/2.1'; canonical_envelope?: Record<string, unknown>;
  the_graph_telemetry?: Record<string, unknown>; oneinch_telemetry?: Record<string, unknown>;
  pnl_attribution?: Record<string, unknown>; risk_engine_audit?: Record<string, unknown>;
  actionable_allocation_vector?: Record<string, unknown>; decision_context_card?: string;
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
      schema_version TEXT, canonical_envelope_json TEXT, the_graph_telemetry_json TEXT,
      oneinch_telemetry_json TEXT, pnl_attribution_json TEXT, risk_engine_audit_json TEXT,
      actionable_allocation_vector_json TEXT, decision_context_card TEXT,
      UNIQUE(agent_id, report_id, content_hash));
      CREATE INDEX IF NOT EXISTS statement_reports_agent_updated ON statement_reports(agent_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS statement_reports_public_rank ON statement_reports(visibility, realized_pnl_usd DESC, updated_at DESC);`);
    const columns = new Set((gatewayDatabase.raw().prepare('PRAGMA table_info(statement_reports)').all() as { name: string }[]).map((column) => column.name));
    for (const [name, definition] of Object.entries({ schema_version: 'TEXT', canonical_envelope_json: 'TEXT', the_graph_telemetry_json: 'TEXT', oneinch_telemetry_json: 'TEXT', pnl_attribution_json: 'TEXT', risk_engine_audit_json: 'TEXT', actionable_allocation_vector_json: 'TEXT', decision_context_card: 'TEXT' })) {
      if (!columns.has(name)) gatewayDatabase.raw().exec(`ALTER TABLE statement_reports ADD COLUMN ${name} ${definition}`);
    }
  }
  private row(row: Record<string, unknown>): StatementRecord {
    const collateral = Number(row.collateral_usd); const debt = Number(row.debt_usd);
    const parse = (key: string) => row[key] ? JSON.parse(String(row[key])) : undefined;
    return { ...(row as unknown as StatementInput), id: String(row.id), agent_id: String(row.agent_id), collateral_usd: collateral, debt_usd: debt,
      ltv: collateral > 0 ? debt / collateral : 0, recommended_ltv: .32, max_ltv: .4, status: row.status as StatementStatus,
      attestation: JSON.parse(String(row.attestation_json)) as StatementRecord['attestation'],
      ...(row.schema_version ? { schema_version: String(row.schema_version) as 'apsd-l/2.1', canonical_envelope: parse('canonical_envelope_json'), the_graph_telemetry: parse('the_graph_telemetry_json'), oneinch_telemetry: parse('oneinch_telemetry_json'), pnl_attribution: parse('pnl_attribution_json'), risk_engine_audit: parse('risk_engine_audit_json'), actionable_allocation_vector: parse('actionable_allocation_vector_json'), decision_context_card: String(row.decision_context_card || '') } : {}),
      created_at: String(row.created_at), updated_at: String(row.updated_at) };
  }
  public ingest(agentId: string, input: StatementInput): { record: StatementRecord; created: boolean } {
    const db = gatewayDatabase.raw(); const existing = db.prepare('SELECT * FROM statement_reports WHERE agent_id=? AND report_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId, input.report_id) as Record<string, unknown> | undefined;
    if (existing && String(existing.content_hash) !== input.content_hash) throw new Error('statement_report_hash_conflict');
    if (existing) return { record: this.row(existing), created: false };
    const timestamp = now(); const id = randomUUID(); const attestation = input.attestation || { status: 'pending' as const };
    db.prepare(`INSERT INTO statement_reports (id,agent_id,report_id,content_hash,visibility,source_chain,source_block,source_timestamp,finality,wallet_address,venue,collateral_usd,debt_usd,realized_pnl_usd,unrealized_pnl_usd,pnl_methodology,status,attestation_json,summary,created_at,updated_at,schema_version,canonical_envelope_json,the_graph_telemetry_json,oneinch_telemetry_json,pnl_attribution_json,risk_engine_audit_json,actionable_allocation_vector_json,decision_context_card) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, agentId, input.report_id, input.content_hash, input.visibility, input.source_chain, input.source_block, input.source_timestamp, input.finality, input.wallet_address || null, input.venue, input.collateral_usd, input.debt_usd, input.realized_pnl_usd ?? null, input.unrealized_pnl_usd ?? null, input.pnl_methodology, input.status || 'received', JSON.stringify(attestation), input.summary || null, timestamp, timestamp, input.schema_version || null, input.canonical_envelope ? JSON.stringify(input.canonical_envelope) : null, input.the_graph_telemetry ? JSON.stringify(input.the_graph_telemetry) : null, input.oneinch_telemetry ? JSON.stringify(input.oneinch_telemetry) : null, input.pnl_attribution ? JSON.stringify(input.pnl_attribution) : null, input.risk_engine_audit ? JSON.stringify(input.risk_engine_audit) : null, input.actionable_allocation_vector ? JSON.stringify(input.actionable_allocation_vector) : null, input.decision_context_card || null);
    return { record: this.row(db.prepare('SELECT * FROM statement_reports WHERE id=?').get(id) as Record<string, unknown>), created: true };
  }
  public latest(agentId: string): StatementRecord | undefined { const row = gatewayDatabase.raw().prepare('SELECT * FROM statement_reports WHERE agent_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId) as Record<string, unknown> | undefined; return row && this.row(row); }
  public leaderboard(limit = 25): StatementRecord[] { return (gatewayDatabase.raw().prepare("SELECT * FROM statement_reports WHERE visibility='public' AND status IN ('received','partial') ORDER BY COALESCE(realized_pnl_usd, unrealized_pnl_usd, 0) DESC LIMIT ?").all(Math.max(1, Math.min(limit, 100))) as Record<string, unknown>[]).map((row) => this.row(row)); }
}
export const statementTracking = new StatementTracking();
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
};
export const statementHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
