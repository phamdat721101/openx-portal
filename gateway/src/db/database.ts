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
