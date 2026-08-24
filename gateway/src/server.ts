/**
 * server.ts — Core Backend Gateway Sidecar for OpenX Deep Research Analyst.
 *
 * Implements:
 *  - GET /health
 *  - GET /v1/agent/status (PRD 001 — Agent Introspection Read Path)
 *  - POST /v1/agent/telemetry (Agent Ingestion Write Path: Traces & Tokens)
 *  - POST /v1/agent/memory/episode (Agent Ingestion Write Path: Insights & Facts)
 *  - POST /v1/agent/skills/candidate (Agent Ingestion Write Path: Discovered Tools)
 *  - GET /v1/agent/telemetry (Portal Ingestion Stream)
 *  - GET /v1/supplier/defi (Phase 2 x402 Micropayment Rail)
 */
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';
import {
  composeAgentStatus,
  parseFields,
} from './services/agentStatusComposer.js';
import { agentIngestionStore } from './services/agentIngestionStore.js';
import { agentRegistry, AgentRegistryError } from './services/agentRegistry.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 7411;

app.use(cors());
app.use(express.json());

// Zod Schemas for Ingestion Endpoints
const TelemetrySchema = z.object({
  agent_id: z.string().min(1, 'agent_id is required'),
  task_id: z.string().min(1, 'task_id is required'),
  model: z.string().default('gemini-3.5'),
  tokens_consumed: z.number().int().nonnegative().default(0),
  tools_used: z.array(z.string()).optional().default([]),
  latency_ms: z.number().nonnegative().optional().default(0),
  status: z.enum(['success', 'failed']).default('success'),
  cost_usdc: z.string().optional(),
  summary: z.string().optional(),
});

const AgentRegisterSchema = z.object({
  agent_id: z.string().uuid().optional(),
  display_name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  model: z.string().trim().max(120).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(32).optional().default([]),
  host_type: z.enum(['kiro-cli', 'claude-code', 'adk-python', 'custom']),
  owner_address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

const MemoryEpisodeSchema = z.object({
  agent_id: z.string().min(1, 'agent_id is required'),
  episode_type: z.enum(['protocol_research', 'market_scan', 'execution_trace']).default('protocol_research'),
  summary: z.string().min(1, 'summary is required'),
  facts_count: z.number().int().nonnegative().default(1),
  confidence: z.number().min(0).max(1).default(0.9),
  entities: z.array(z.string()).optional().default([]),
});

const SkillCandidateSchema = z.object({
  agent_id: z.string().min(1, 'agent_id is required'),
  skill_slug: z.string().min(1, 'skill_slug is required'),
  display_name: z.string().min(1, 'display_name is required'),
  capability_ids: z.array(z.string()).default([]),
  code_template: z.string().optional(),
});

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'openx-deep-research-analyst-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ...agentRegistry.health(),
  });
});

app.post('/v1/agent/register', (req: Request, res: Response): void => {
  const parsed = AgentRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload', message: parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ') });
    return;
  }
  if (process.env.OPENX_AGENT_REGISTRATION_MODE === 'production') {
    const configuredToken = process.env.OPENX_CONNECT_TOKEN;
    const authorization = req.headers.authorization;
    if (!configuredToken) {
      res.status(503).json({ ok: false, error: 'registration_unavailable', message: 'Production connect-token verification is not configured' });
      return;
    }
    if (authorization !== `Bearer ${configuredToken}`) {
      res.status(401).json({ ok: false, error: 'invalid_connect_token', message: 'A valid connect token is required' });
      return;
    }
  }
  try {
    const credential = req.headers['x-agent-key'];
    const result = agentRegistry.register(parsed.data, typeof credential === 'string' ? credential : undefined);
    res.status(result.created ? 201 : 200).json({
      ok: true,
      status: 'registered',
      agent: result.agent,
      ...(result.credential ? { credential: { agent_key: result.credential, shown_once: true } } : {}),
      telemetry_endpoint: `http://localhost:${PORT}/v1/agent/telemetry`,
    });
  } catch (error) {
    if (error instanceof AgentRegistryError) {
      res.status(error.status).json({ ok: false, error: error.code, message: error.code.replace(/_/g, ' ') });
      return;
    }
    res.status(500).json({ ok: false, error: 'internal_error', message: 'Unable to register agent' });
  }
});

app.get('/v1/agents', (req: Request, res: Response): void => {
  const includeRevoked = req.query.include === 'revoked';
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const agents = agentRegistry.list(includeRevoked).filter((agent) => !state || agent.state === state);
  res.json({ ok: true, count: agents.length, agents });
});

app.get('/v1/agents/:agentId', (req: Request, res: Response): void => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) {
    res.status(404).json({ ok: false, error: 'agent_not_found', message: 'Agent is not registered' });
    return;
  }
  res.json({ ok: true, agent, activity: agentIngestionStore.getLiveAgentDelta(agent.agent_id) });
});

/**
 * PRD 001: GET /v1/agent/status
 */
app.get('/v1/agent/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = typeof req.query.agentId === 'string' ? req.query.agentId.trim() : '';

    if (!agentId) {
      res.status(400).json({
        ok: false,
        error: 'missing_agent_id',
        message: 'agentId query parameter is required',
      });
      return;
    }

    const fieldsParam = typeof req.query.fields === 'string' ? req.query.fields : undefined;
    const { valid, fields } = parseFields(fieldsParam);

    if (!valid) {
      res.status(400).json({
        ok: false,
        error: 'invalid_fields',
        message: 'fields must be a comma-separated subset of: info,status,model,credits,memory',
      });
      return;
    }

    const erc8004Header = req.headers['x-erc8004-agent-id'] as string | undefined;
    const authHeader = req.headers['authorization'] as string | undefined;

    const result = await composeAgentStatus({
      agentId,
      fields: Array.from(fields),
      erc8004Header,
      authHeader,
    });

    res.status(200).json(result);
  } catch (error: any) {
    const rawMessage = error?.message || 'Internal server error occurred';
    res.status(500).json({
      ok: false,
      error: 'internal_error',
      message: String(rawMessage).slice(0, 200),
    });
  }
});

/**
 * POST /v1/agent/telemetry
 * Ingestion write path for execution traces, latency, tokens, and tool calls.
 */
app.post('/v1/agent/telemetry', (req: Request, res: Response): void => {
  const parseResult = TelemetrySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: 'invalid_payload',
      message: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
    return;
  }

  const agentKey = req.headers['x-agent-key'];
  if (!agentRegistry.authorizeTelemetry(parseResult.data.agent_id, typeof agentKey === 'string' ? agentKey : undefined)) {
    res.status(401).json({ ok: false, error: 'invalid_agent_key', message: 'A valid agent key is required' });
    return;
  }
  try {
    agentRegistry.recordHeartbeat(parseResult.data.agent_id, { model: parseResult.data.model, capabilities: parseResult.data.tools_used });
  } catch (error) {
    if (error instanceof AgentRegistryError) {
      res.status(error.status).json({ ok: false, error: error.code, message: error.code.replace(/_/g, ' ') });
      return;
    }
    throw error;
  }
  const stored = agentIngestionStore.recordTelemetry(parseResult.data);
  res.status(201).json({
    ok: true,
    event_type: 'telemetry',
    id: stored.id,
    agent_id: stored.agent_id,
    ingested_at: stored.received_at,
  });
});

/**
 * POST /v1/agent/memory/episode
 * Ingestion write path for research episodes, facts, and insights.
 */
app.post('/v1/agent/memory/episode', (req: Request, res: Response): void => {
  const parseResult = MemoryEpisodeSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: 'invalid_payload',
      message: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
    return;
  }

  const stored = agentIngestionStore.recordMemoryEpisode(parseResult.data);
  res.status(201).json({
    ok: true,
    event_type: 'memory_episode',
    id: stored.id,
    agent_id: stored.agent_id,
    ingested_at: stored.received_at,
  });
});

/**
 * POST /v1/agent/skills/candidate
 * Ingestion write path for synthesized reusable skill templates.
 */
app.post('/v1/agent/skills/candidate', (req: Request, res: Response): void => {
  const parseResult = SkillCandidateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      ok: false,
      error: 'invalid_payload',
      message: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
    return;
  }

  const stored = agentIngestionStore.recordCandidateSkill(parseResult.data);
  res.status(201).json({
    ok: true,
    event_type: 'skill_candidate',
    id: stored.id,
    agent_id: stored.agent_id,
    ingested_at: stored.received_at,
  });
});

/**
 * GET /v1/agent/telemetry
 * Queries recent trace logs for an agent or all agents (for Portal connect view).
 */
app.get('/v1/agent/telemetry', (req: Request, res: Response): void => {
  const agentId = typeof req.query.agentId === 'string' ? req.query.agentId.trim() : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  if (agentId) {
    const traces = agentIngestionStore.getTelemetry(agentId, limit);
    res.status(200).json({ ok: true, agent_id: agentId, count: traces.length, traces });
  } else {
    const traces = agentIngestionStore.getAllRecentTelemetry(limit);
    res.status(200).json({ ok: true, count: traces.length, traces });
  }
});

/**
 * PRD §4.1 capability: analytics.fetch_premium_feed
 *
 * Phase 2 tracer-bullet route for XRPL x402 payment challenge.
 */
app.get('/v1/supplier/defi', (req: Request, res: Response) => {
  res.status(501).json({
    ok: false,
    phase: 2,
    error: 'not_implemented',
    message:
      'Phase 2 (HyperMove MCP + n-payment XRPL x402 + nim-skill verification) is being wired.',
    requested_feed_id: req.query.feedId ?? null,
    intended_402_shape: {
      status: 402,
      headers: {
        'WWW-Authenticate':
          'x402 address="rLusdWalletAddressXYZ", amount="0.05", currency="RLUSD", network="xrpl-testnet"',
      },
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[openx-gateway] Core backend sidecar listening on http://localhost:${PORT}`);
  });
}
