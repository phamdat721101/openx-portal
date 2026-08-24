import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../src/services/agentRegistry.js';

describe('Agent registry persistence', () => {
  it('loads a registered agent after recreation without exposing its credential', () => {
    // seam:registry-persistence
    const directory = mkdtempSync(join(tmpdir(), 'openx-registry-'));
    const path = join(directory, 'registry.json');
    try {
      const original = new AgentRegistry({ mode: 'development', registryPath: path });
      const created = original.register({ display_name: 'Persistent Agent', host_type: 'custom' });
      const restored = new AgentRegistry({ mode: 'development', registryPath: path });
      expect(restored.get(created.agent.agent_id)).toMatchObject({ display_name: 'Persistent Agent', state: 'registered' });
      expect(restored.get(created.agent.agent_id)).not.toHaveProperty('credential_hash');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
