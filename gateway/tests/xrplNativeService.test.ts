import { beforeEach, describe, expect, it } from 'vitest';
import { gatewayDatabase } from '../src/db/database.js';
import { xrplNativeService } from '../src/services/xrplNativeService.js';

// seam:xrpl-native-state
describe('XRPL-native management state', () => {
  beforeEach(() => {
    const db = gatewayDatabase.raw();
    for (const table of ['xrpl_routing_policy_acks', 'xrpl_routing_policies', 'xrpl_wallet_operations', 'xrpl_wallet_profiles', 'xrpl_ledger_snapshots']) db.exec(`DELETE FROM ${table}`);
  });

  it('keeps per-agent n-payment profile references without any seed material', () => {
    const profile = xrplNativeService.createProfile('agent-a', 'n-payment:agent-a', 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', { daily: '100', perTx: '5' }) as any;
    expect(profile).toMatchObject({ agent_id: 'agent-a', profile_id: 'n-payment:agent-a', per_tx_limit_rlusd: '5' });
    expect(JSON.stringify(profile)).not.toMatch(/seed|private/i);
  });

  it('versions policies and only reports acknowledgement for the exact policy', () => {
    const first = xrplNativeService.publishPolicy('agent-a', [{ category: 'research', model: 'gpt-test', minimum_samples: 20 }]);
    const second = xrplNativeService.publishPolicy('agent-a', [{ category: 'research', model: 'gpt-better', minimum_samples: 20 }]);
    expect(second.version).toBe(first.version + 1);
    expect(xrplNativeService.latestPolicy('agent-a')).toMatchObject({ id: second.id, acknowledged: false });
    expect(xrplNativeService.acknowledgePolicy('agent-a', second.id)).toMatchObject({ id: second.id, acknowledged: true });
  });

  it('records trustline operations with receipt hashes but no signer data', () => {
    const operation = xrplNativeService.recordOperation('agent-a', 'trustline', 'validated', { no_ripple: true }, undefined, 'A'.repeat(64));
    expect(operation).toMatchObject({ kind: 'trustline', transaction_hash: 'A'.repeat(64) });
    expect(JSON.stringify(operation)).not.toMatch(/seed|private/i);
  });
});
