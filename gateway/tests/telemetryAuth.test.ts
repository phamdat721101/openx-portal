import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../src/services/agentRegistry.js';

describe('Production telemetry authentication', () => {
  it('accepts only the credential issued for the same registered agent', () => {
    // seam:telemetry-auth
    const registry = new AgentRegistry({ mode: 'production' });
    const created = registry.register({ display_name: 'Authenticated Agent', host_type: 'custom' });
    expect(registry.authorizeTelemetry(created.agent.agent_id, created.credential)).toBe(true);
    expect(registry.authorizeTelemetry(created.agent.agent_id, 'oxag_wrong')).toBe(false);
    expect(registry.authorizeTelemetry('other-agent', created.credential)).toBe(false);
  });
});
