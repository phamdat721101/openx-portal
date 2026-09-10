import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultPath = (): string => process.env.NODE_ENV === 'test'
  ? ':memory:'
  : process.env.OPENX_DB_PATH || resolve('.openx/openx-gateway.db');

/** Versioned, SQLite/WAL persistence boundary shared by Gateway services. */
export class GatewayDatabase {
  private readonly database: Database.Database;
  public readonly path: string;

  constructor(path = defaultPath()) {
    this.path = path;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.database = new Database(path);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = NORMAL');
    this.database.pragma('busy_timeout = 5000');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS gateway_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_runs (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, trigger TEXT NOT NULL, created_at TEXT NOT NULL, report TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_findings (id TEXT PRIMARY KEY, audit_run_id TEXT NOT NULL, agent_id TEXT NOT NULL, dimension TEXT NOT NULL, verdict TEXT NOT NULL, title TEXT NOT NULL, evidence TEXT NOT NULL, rule_version TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT OR IGNORE INTO _migrations(version, applied_at) VALUES (1, datetime('now'));
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS xrpl_task_runs (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT NOT NULL, title TEXT, category TEXT, model TEXT NOT NULL, state TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, latency_ms INTEGER NOT NULL DEFAULT 0, deliverable_markdown TEXT, deliverable_sha256 TEXT, created_at TEXT NOT NULL, completed_at TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS xrpl_task_runs_agent_task ON xrpl_task_runs(agent_id, task_id);
      CREATE TABLE IF NOT EXISTS xrpl_task_artifacts (id TEXT PRIMARY KEY, task_run_id TEXT NOT NULL, filename TEXT NOT NULL, media_type TEXT NOT NULL, bytes INTEGER NOT NULL, storage_uri TEXT, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS xrpl_task_log_entries (event_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, task_id TEXT NOT NULL, sequence INTEGER NOT NULL, phase TEXT NOT NULL, progress_pct REAL, kind TEXT NOT NULL, markdown TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(agent_id, task_id, sequence));
      CREATE INDEX IF NOT EXISTS xrpl_task_log_entries_task ON xrpl_task_log_entries(agent_id, task_id, sequence);
      CREATE TABLE IF NOT EXISTS xrpl_wallet_profiles (agent_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL UNIQUE, address TEXT, network TEXT NOT NULL, daily_limit_rlusd TEXT NOT NULL, per_tx_limit_rlusd TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS xrpl_wallet_operations (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL, amount_rlusd TEXT, transaction_hash TEXT, detail TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS xrpl_ledger_snapshots (id TEXT PRIMARY KEY, ledger_index INTEGER NOT NULL, ledger_hash TEXT, payload TEXT NOT NULL, source_errors TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS xrpl_routing_policies (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, version INTEGER NOT NULL, rules TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(agent_id, version));
      CREATE TABLE IF NOT EXISTS xrpl_routing_policy_acks (policy_id TEXT NOT NULL, agent_id TEXT NOT NULL, applied_at TEXT NOT NULL, PRIMARY KEY(policy_id, agent_id));
      INSERT OR IGNORE INTO _migrations(version, applied_at) VALUES (10, datetime('now'));
      INSERT OR IGNORE INTO _migrations(version, applied_at) VALUES (11, datetime('now'));
    `);
  }

  public read<T>(key: string, fallback: T): T {
    const row = this.database.prepare('SELECT value FROM gateway_state WHERE key = ?').get(key) as { value?: string } | undefined;
    if (!row?.value) return fallback;
    try { return JSON.parse(row.value) as T; } catch { return fallback; }
  }

  public write(key: string, value: unknown): void {
    this.database.prepare('INSERT INTO gateway_state(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .run(key, JSON.stringify(value), new Date().toISOString());
  }

  public raw(): Database.Database { return this.database; }
  public health() { return { database_persistence: this.path === ':memory:' ? 'memory' : 'enabled', database_path: this.path === ':memory:' ? null : this.path }; }
}

export const gatewayDatabase = new GatewayDatabase();
