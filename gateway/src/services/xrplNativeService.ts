import { randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

const now = () => new Date().toISOString();
const id = () => randomUUID();

export class XrplNativeService {
  public createProfile(agentId: string, profileId: string, address: string | null, limits = { daily: '100', perTx: '5' }) { const timestamp = now(); gatewayDatabase.raw().prepare('INSERT INTO xrpl_wallet_profiles(agent_id, profile_id, address, network, daily_limit_rlusd, per_tx_limit_rlusd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(agent_id) DO UPDATE SET profile_id=excluded.profile_id,address=excluded.address,updated_at=excluded.updated_at').run(agentId, profileId, address, 'xrpl-testnet', limits.daily, limits.perTx, timestamp, timestamp); return this.profile(agentId); }
  public profile(agentId: string) { return gatewayDatabase.raw().prepare('SELECT agent_id, profile_id, address, network, daily_limit_rlusd, per_tx_limit_rlusd, updated_at FROM xrpl_wallet_profiles WHERE agent_id = ?').get(agentId) || null; }
  public recordOperation(agentId: string, kind: string, status: string, detail: unknown, amount?: string, hash?: string) { const operation = { id: id(), agent_id: agentId, kind, status, amount_rlusd: amount || null, transaction_hash: hash || null, detail, created_at: now() }; gatewayDatabase.raw().prepare('INSERT INTO xrpl_wallet_operations(id, agent_id, kind, status, amount_rlusd, transaction_hash, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(operation.id, agentId, kind, status, operation.amount_rlusd, operation.transaction_hash, JSON.stringify(detail), operation.created_at); return operation; }
  public publishPolicy(agentId: string, rules: unknown) {
    return gatewayDatabase.raw().transaction(() => {
      const current = gatewayDatabase.raw().prepare('SELECT MAX(version) AS version FROM xrpl_routing_policies WHERE agent_id = ?').get(agentId) as { version?: number };
      const policy = { id: id(), agent_id: agentId, version: (current.version || 0) + 1, rules, status: 'published', created_at: now() };
      gatewayDatabase.raw().prepare('INSERT INTO xrpl_routing_policies(id, agent_id, version, rules, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(policy.id, agentId, policy.version, JSON.stringify(rules), policy.status, policy.created_at);
      return policy;
    })();
  }
  public latestPolicy(agentId: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM xrpl_routing_policies WHERE agent_id = ? ORDER BY version DESC LIMIT 1').get(agentId) as any; return row ? { ...row, rules: JSON.parse(row.rules), acknowledged: Boolean(gatewayDatabase.raw().prepare('SELECT 1 FROM xrpl_routing_policy_acks WHERE policy_id = ? AND agent_id = ?').get(row.id, agentId)) } : null; }
  public acknowledgePolicy(agentId: string, policyId: string) { gatewayDatabase.raw().prepare('INSERT OR REPLACE INTO xrpl_routing_policy_acks(policy_id, agent_id, applied_at) VALUES (?, ?, ?)').run(policyId, agentId, now()); return this.latestPolicy(agentId); }
}
export const xrplNativeService = new XrplNativeService();
