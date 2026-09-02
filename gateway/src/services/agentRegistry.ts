import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

export type AgentHostType = 'kiro-cli' | 'claude-code' | 'adk-python' | 'custom';
export type RegistrationSource = 'explicit' | 'auto_discovered';
export type ConnectionState = 'registered' | 'online' | 'offline' | 'auto_discovered' | 'revoked';

export interface AgentRegistrationInput {
  agent_id?: string;
  display_name: string;
  slug?: string;
  description?: string;
  model?: string;
  capabilities?: string[];
  host_type: AgentHostType;
  owner_address?: string;
  wallet_address?: string;
}

export interface RegisteredAgent {
  agent_id: string;
  slug: string;
  display_name: string;
  description: string | null;
  model: string | null;
  capabilities: string[];
  host_type: AgentHostType;
  owner_address: string | null;
  wallet_address: string | null;
  owner_verified: boolean;
  registration_source: RegistrationSource;
  state: ConnectionState;
  registered_at: string;
  last_seen_at: string | null;
  credential_hash: string | null;
  credential_last_rotated_at: string | null;
}

export type AgentProjection = Omit<RegisteredAgent, 'credential_hash'>;

export class AgentRegistryError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

interface AgentRegistryOptions {
  mode?: 'development' | 'production';
  registryPath?: string;
  onlineWindowSeconds?: number;
}

const slugify = (value: string) => value.toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'agent';

const hashCredential = (credential: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(credential, salt, 32).toString('hex');
  return `${salt}:${hash}`;
};

const verifyCredential = (credential: string, encoded: string | null): boolean => {
  if (!encoded) return false;
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(credential, salt, 32).toString('hex');
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
};

export class AgentRegistry {
  private readonly records = new Map<string, RegisteredAgent>();
  private readonly mode: 'development' | 'production';
  private readonly registryPath?: string;
  private readonly onlineWindowMs: number;
  private loadError: string | null = null;

  constructor(options: AgentRegistryOptions = {}) {
    this.mode = options.mode || (process.env.OPENX_AGENT_REGISTRATION_MODE === 'production' ? 'production' : 'development');
    this.registryPath = options.registryPath || process.env.OPENX_AGENT_REGISTRY_PATH;
    this.onlineWindowMs = (options.onlineWindowSeconds || Number(process.env.OPENX_AGENT_ONLINE_WINDOW_SECONDS) || 90) * 1000;
    this.load();
  }

  public register(input: AgentRegistrationInput, existingCredential?: string): { agent: AgentProjection; credential?: string; created: boolean } {
    this.assertAvailable();
    let agentId = input.agent_id;
    let existing = agentId ? this.records.get(agentId) : undefined;

    // If no agent_id provided, look up by existingCredential hash
    if (!existing && existingCredential) {
      const byCred = Array.from(this.records.values()).find((rec) => verifyCredential(existingCredential, rec.credential_hash));
      if (byCred) {
        existing = byCred;
        agentId = byCred.agent_id;
      }
    }

    // In development mode or matching slug/name with same host_type, resolve existing agent to avoid duplicates
    if (!existing && !input.agent_id && this.mode === 'development') {
      const matchSlug = (input.slug || input.display_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const found = Array.from(this.records.values()).find((rec) =>
        (rec.slug === matchSlug || rec.display_name.trim().toLowerCase() === input.display_name.trim().toLowerCase()) &&
        rec.host_type === input.host_type &&
        (!input.owner_address || rec.owner_address === input.owner_address)
      );
      if (found) {
        existing = found;
        agentId = found.agent_id;
      }
    }

    if (existing) {
      if (this.mode === 'production' && !verifyCredential(existingCredential || '', existing.credential_hash)) {
        throw new AgentRegistryError('agent_already_registered', 409);
      }
      this.updateMutable(existing, input);
      this.persist();
      return { agent: this.project(existing), created: false };
    }

    agentId = agentId || randomUUID();
    const agent: RegisteredAgent = {
      agent_id: agentId,
      slug: this.uniqueSlug(input.slug || input.display_name),
      display_name: input.display_name,
      description: input.description || null,
      model: input.model || null,
      capabilities: input.capabilities || [],
      host_type: input.host_type,
      owner_address: input.owner_address || null,
      wallet_address: input.wallet_address || input.owner_address || null,
      owner_verified: false,
      registration_source: 'explicit',
      state: 'registered',
      registered_at: new Date().toISOString(),
      last_seen_at: null,
      credential_hash: null,
      credential_last_rotated_at: null,
    };
    const credential = `oxag_${randomBytes(24).toString('base64url')}`;
    agent.credential_hash = hashCredential(credential);
    agent.credential_last_rotated_at = new Date().toISOString();
    this.records.set(agentId, agent);
    this.persist();
    return { agent: this.project(agent), credential, created: true };
  }

  /** Restores a previously issued identity without rotating its credential or changing liveness. */
  public claim(agentId: string, credential: string): AgentProjection {
    this.assertAvailable();
    const agent = this.records.get(agentId);
    if (!agent || !verifyCredential(credential, agent.credential_hash)) {
      throw new AgentRegistryError('invalid_agent_key', 401);
    }
    return this.project(agent);
  }

  public recordHeartbeat(agentId: string, metadata: { model?: string; capabilities?: string[] }): AgentProjection {
    this.assertAvailable();
    let agent = this.records.get(agentId);
    if (!agent) {
      if (this.mode === 'production' || process.env.OPENX_ALLOW_ANONYMOUS_TELEMETRY === 'false') {
        throw new AgentRegistryError('agent_not_registered', 401);
      }
      agent = this.createAutoDiscovered(agentId, metadata);
      this.records.set(agentId, agent);
    }
    agent.last_seen_at = new Date().toISOString();
    agent.state = 'online';
    if (metadata.model) agent.model = metadata.model;
    if (metadata.capabilities?.length) agent.capabilities = Array.from(new Set([...agent.capabilities, ...metadata.capabilities]));
    this.persist();
    return this.project(agent);
  }

  public authorizeTelemetry(agentId: string, credential?: string): boolean {
    const production = this.mode === 'production' || process.env.OPENX_AGENT_REGISTRATION_MODE === 'production';
    if (!production) return true;
    const agent = this.records.get(agentId);
    return Boolean(agent && credential && verifyCredential(credential, agent.credential_hash));
  }

  public list(includeRevoked = false): AgentProjection[] {
    return Array.from(this.records.values())
      .map((agent) => this.project(agent))
      .filter((agent) => includeRevoked || agent.state !== 'revoked')
      .sort((a, b) => (b.last_seen_at || '').localeCompare(a.last_seen_at || ''));
  }

  public get(agentId: string): AgentProjection | undefined {
    const agent = this.records.get(agentId);
    return agent ? this.project(agent) : undefined;
  }

  public health() {
    return { registry_persistence: this.loadError ? 'error' : 'enabled', registry_error: this.loadError, ...gatewayDatabase.health() };
  }

  public clear(): void {
    this.records.clear();
    this.loadError = null;
  }

  private createAutoDiscovered(agentId: string, metadata: { model?: string; capabilities?: string[] }): RegisteredAgent {
    const now = new Date().toISOString();
    return {
      agent_id: agentId,
      slug: this.uniqueSlug(agentId),
      display_name: `Unclaimed local agent (${agentId.slice(0, 8)})`,
      description: null,
      model: metadata.model || null,
      capabilities: metadata.capabilities || [],
      host_type: 'custom',
      owner_address: null,
      wallet_address: null,
      owner_verified: false,
      registration_source: 'auto_discovered',
      state: 'auto_discovered',
      registered_at: now,
      last_seen_at: now,
      credential_hash: null,
      credential_last_rotated_at: null,
    };
  }

  private project(agent: RegisteredAgent): AgentProjection {
    const { credential_hash: _credentialHash, ...projection } = agent;
    const state = projection.state === 'revoked' || projection.state === 'auto_discovered'
      ? projection.state
      : this.isOnline(projection.last_seen_at) ? 'online' : projection.last_seen_at ? 'offline' : 'registered';
    return { ...projection, state };
  }

  private isOnline(lastSeenAt: string | null): boolean {
    return Boolean(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= this.onlineWindowMs);
  }

  private updateMutable(agent: RegisteredAgent, input: AgentRegistrationInput): void {
    agent.display_name = input.display_name;
    agent.description = input.description || null;
    agent.model = input.model || null;
    agent.capabilities = input.capabilities || [];
    agent.host_type = input.host_type;
    agent.owner_address = input.owner_address || null;
    agent.wallet_address = input.wallet_address || input.owner_address || null;
    if (input.slug) agent.slug = this.uniqueSlug(input.slug, agent.agent_id);
  }

  private uniqueSlug(value: string, currentAgentId?: string): string {
    const base = slugify(value);
    let candidate = base;
    let suffix = 2;
    while (Array.from(this.records.values()).some((agent) => agent.agent_id !== currentAgentId && agent.slug === candidate)) {
      candidate = `${base}-${suffix++}`;
    }
    return candidate;
  }

  private assertAvailable(): void {
    if (this.loadError) throw new AgentRegistryError('registry_unavailable', 503);
  }

  private load(): void {
    if (!this.registryPath) {
      gatewayDatabase.read<RegisteredAgent[]>('agent_registry', []).forEach((record) => this.records.set(record.agent_id, record));
      return;
    }
    if (!existsSync(this.registryPath)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.registryPath, 'utf8')) as RegisteredAgent[];
      if (!Array.isArray(parsed)) throw new Error('registry file must contain an array');
      parsed.forEach((record) => this.records.set(record.agent_id, record));
    } catch (error) {
      this.loadError = `Unable to load registry: ${(error as Error).message}`;
    }
  }

  private persist(): void {
    if (!this.registryPath) { gatewayDatabase.write('agent_registry', Array.from(this.records.values())); return; }
    mkdirSync(dirname(this.registryPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.registryPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(Array.from(this.records.values()), null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporaryPath, this.registryPath);
  }
}

export const agentRegistry = new AgentRegistry();
