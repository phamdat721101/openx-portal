import { describe, expect, it } from 'vitest';
import { AgentRegistry } from '../src/services/agentRegistry.js';

describe('Agent registry', () => {
  it('creates a redacted record and returns a credential only once', () => {
    // seam:gateway-validation
    const registry = new AgentRegistry({ mode: 'development' });
    const first = registry.register({ agent_id: 'c3f25f57-8a64-4b96-a3d2-b2c65187da1a', display_name: 'Research Runner', host_type: 'adk-python' });
    const second = registry.register({ agent_id: 'c3f25f57-8a64-4b96-a3d2-b2c65187da1a', display_name: 'Research Runner', host_type: 'adk-python' });

    expect(first.created).toBe(true);
    expect(first.credential).toMatch(/^oxag_/);
    expect(first.agent).not.toHaveProperty('credential_hash');
    expect(second.created).toBe(false);
    expect(second.credential).toBeUndefined();
  });

  it('reuses existing registration in development mode when agent_id is omitted to prevent duplicates', () => {
    const registry = new AgentRegistry({ mode: 'development' });
    const first = registry.register({ display_name: 'Antigravity BD Agent', host_type: 'custom' });
    const second = registry.register({ display_name: 'Antigravity BD Agent', host_type: 'custom' });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.agent.agent_id).toBe(first.agent.agent_id);
    expect(second.agent.slug).toBe(first.agent.slug);
  });

  it('rotates agent credential, invalidating the previous one and updating rotation timestamp', () => {
    const registry = new AgentRegistry({ mode: 'production' });
    const registration = registry.register({ display_name: 'Key Rotation Target', host_type: 'custom' });
    const agentId = registration.agent.agent_id;
    const oldKey = registration.credential!;

    expect(() => registry.rotateCredential(agentId, 'wrong-key-that-is-long-enough')).toThrow();

    const rotation = registry.rotateCredential(agentId, oldKey);
    expect(rotation.credential).toMatch(/^oxag_/);
    expect(rotation.credential).not.toBe(oldKey);
    expect(rotation.agent.credential_last_rotated_at).toBeDefined();

    // Old key must no longer authorize writes
    expect(registry.authorizeTelemetry(agentId, oldKey)).toBe(false);
    // New key must authorize writes
    expect(registry.authorizeTelemetry(agentId, rotation.credential)).toBe(true);
  });

  it('revokes an agent and prevents future authentication', () => {
    const registry = new AgentRegistry({ mode: 'production' });
    const registration = registry.register({ display_name: 'Revocation Target', host_type: 'custom' });
    const agentId = registration.agent.agent_id;
    const key = registration.credential!;

    const revoked = registry.revoke(agentId, key);
    expect(revoked.state).toBe('revoked');
    expect(registry.authorizeTelemetry(agentId, key)).toBe(false);
    expect(() => registry.rotateCredential(agentId, key)).toThrow();
  });
});
