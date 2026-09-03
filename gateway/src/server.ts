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
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  composeAgentStatus,
  parseFields,
} from './services/agentStatusComposer.js';
import { agentIngestionStore } from './services/agentIngestionStore.js';
import { agentRegistry, AgentRegistryError } from './services/agentRegistry.js';
import { dreamState, hyperMove, McpError, DreamRun, ManagedLesson } from './services/dreamGateway.js';
import { usageLedger } from './services/usageLedger.js';
import { xrplTestnetSettlement } from './services/xrplSettlement.js';
import { nPaymentXrplWallet } from './services/nPaymentXrplWallet.js';
import { walletService } from './services/walletService.js';
import { auditorService } from './services/auditorService.js';
import { agentKnowledgeArchive, KnowledgeInput } from './services/agentKnowledgeArchive.js';
import { SkillLifecycleStatus } from './types/agentIngestion.js';

dotenv.config();

export const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 7411;
const HOST = process.env.OPENX_GATEWAY_HOST || '0.0.0.0';

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
  task_state: z.enum(['started', 'heartbeat', 'completed', 'failed']).optional(),
  task_title: z.string().trim().max(160).optional(),
  task_category: z.string().trim().max(80).optional(),
  current_phase: z.string().trim().max(120).optional(),
  progress_pct: z.number().min(0).max(100).optional(),
  summary: z.string().trim().max(240).optional(),
}).strict();

const AgentRegisterSchema = z.object({
  agent_id: z.string().uuid().optional(),
  display_name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).optional(),
  model: z.string().trim().max(120).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(32).optional().default([]),
  host_type: z.enum(['kiro-cli', 'claude-code', 'adk-python', 'custom']),
  owner_address: z.string().trim().regex(/^(0x[a-fA-F0-9]{40}|r[1-9A-HJ-NP-Za-km-z]{24,34})$/).optional(),
  wallet_address: z.string().trim().regex(/^(0x[a-fA-F0-9]{40}|r[1-9A-HJ-NP-Za-km-z]{24,34})$/).optional(),
}).strict();
const AgentSyncSchema = z.object({
  agent_id: z.string().min(1),
  model: z.string().trim().max(120).optional(),
  tools: z.array(z.string().trim().min(1).max(160)).max(100).optional().default([]),
  skills: z.array(z.string().trim().min(1).max(160)).max(100).optional().default([]),
  plan_id: z.enum(['starter', 'pro', 'enterprise']).optional(),
}).strict();
const AgentClaimSchema = z.object({
  agent_id: z.string().uuid(),
  agent_key: z.string().trim().min(20).max(256),
}).strict();

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
const UsageEventSchema = z.object({
  event_id: z.string().trim().min(1).max(160),
  agent_id: z.string().min(1, 'agent_id is required'),
  occurred_at: z.string().datetime(),
  plan_id: z.enum(['starter', 'pro', 'enterprise']).optional(),
  model_usage: z.array(z.object({
    provider: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(160),
    input_tokens: z.number().int().nonnegative().optional(), output_tokens: z.number().int().nonnegative().optional(),
    cached_input_tokens: z.number().int().nonnegative().optional(), reasoning_tokens: z.number().int().nonnegative().optional(),
  }).strict()).max(100).optional().default([]),
  tool_calls: z.array(z.object({
    tool_id: z.string().trim().min(1).max(160), calls: z.number().int().positive().max(10_000),
    billable_units: z.number().nonnegative().max(1_000_000).optional(), outcome: z.enum(['success', 'failed']), latency_ms: z.number().nonnegative().optional(),
  }).strict()).max(100).optional().default([]),
  skill_invocations: z.array(z.object({
    skill_id: z.string().trim().min(1).max(160), calls: z.number().int().positive().max(10_000), outcome: z.enum(['success', 'failed']),
  }).strict()).max(100).optional().default([]),
  nim_savings: z.array(z.object({
    primitive: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(160), token_kind: z.enum(['input', 'output', 'cached_input', 'reasoning']),
    baseline_tokens: z.number().int().nonnegative(), actual_tokens: z.number().int().nonnegative(),
  }).strict()).max(100).optional().default([]),
}).strict();

const DreamLinkSchema = z.object({ hypermove_agent_id: z.string().trim().min(1).max(160) });
const DreamTriggerSchema = z.object({ preset: z.enum(['frugal', 'balanced', 'thorough']).default('balanced'), budget_usd: z.number().positive().max(0.5).default(0.1) });
const XrplSettlementProofSchema = z.object({ transaction_hash: z.string().regex(/^[A-Fa-f0-9]{64}$/), expected_amount: z.string().regex(/^\d+(\.\d+)?$/) }).strict();
const DreamCredentialSchema = z.object({ token: z.string().trim().min(20).max(4096) });
const DreamSetupSchema = z.object({ token: z.string().trim().min(20).max(4096).optional(), hypermove_agent_id: z.string().trim().min(1).max(160).optional() }).strict();
const SkillStatusSchema = z.object({ status: z.enum(['active', 'in_audit', 'deprecated']) }).strict();
const AuditorChatSchema = z.object({ message: z.string().trim().min(1).max(1200), client_request_id: z.string().trim().min(1).max(120).optional() }).strict();
const WebMcpNavigationSchema = z.object({ section: z.enum(['studio', 'skills', 'credit-model', 'dream-cycle', 'auditor']) }).strict();
const LessonSchema = z.object({ content: z.string().trim().min(1).max(4000), source: z.enum(['manual', 'dream_cycle']).default('manual') });
const LessonResolutionSchema = z.object({ action: z.enum(['PROMOTED_CONSTRAINT', 'QUARANTINED', 'REJECTED']) });

type DreamPaymentQuote = { quote_id: string; amount: string; currency: string; destination: string; issuer: string; nonce: string; expires_at?: string };
const paymentQuoteFrom = (value: unknown): DreamPaymentQuote | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const data = value as Record<string, unknown>;
  for (const key of ['quote', 'payment', 'data']) {
    const nested = data[key];
    if (nested && typeof nested === 'object') {
      const quote = paymentQuoteFrom(nested);
      if (quote) return quote;
    }
  }
  const quoteId = typeof data.quote_id === 'string' ? data.quote_id : typeof data.quoteId === 'string' ? data.quoteId : undefined;
  const destination = typeof data.destination === 'string' ? data.destination : typeof data.merchant === 'string' ? data.merchant : undefined;
  const amount = typeof data.amount === 'string' ? data.amount : typeof data.amount === 'number' ? String(data.amount) : undefined;
  if (!quoteId || !destination || !amount || typeof data.currency !== 'string' || typeof data.issuer !== 'string' || typeof data.nonce !== 'string') return undefined;
  return { quote_id: quoteId, destination, amount, currency: data.currency, issuer: data.issuer, nonce: data.nonce, ...(typeof data.expires_at === 'string' ? { expires_at: data.expires_at } : {}) };
};
const learningBriefFrom = (result: unknown) => {
  const data = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const stages = data.stage_summaries && typeof data.stage_summaries === 'object' ? data.stage_summaries as Record<string, unknown> : undefined;
  const morning = typeof data.daily_digest === 'string' ? data.daily_digest : typeof data.morning_brief === 'string' ? data.morning_brief : undefined;
  const constraints = Array.isArray(data.active_constraints) ? data.active_constraints.length : 0;
  return { generated_at: new Date().toISOString(), ...(stages ? { stage_summaries: stages } : {}), ...(morning ? { morning_brief: morning } : {}), constraints_count: constraints };
};
const persistDreamLessons = (agentId: string, runId: string, result: unknown): void => {
  const lessons = result && typeof result === 'object' ? (result as { lessons?: unknown }).lessons : undefined;
  if (!Array.isArray(lessons)) {
    const data = result && typeof result === 'object' ? result as Record<string, unknown> : {};
    const candidates = [data.morning_brief, data.daily_digest, data.summary_narrative].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    for (const candidate of candidates) dreamState.addLesson(agentId, candidate.slice(0, 4000), 'dream_cycle', runId);
    return;
  }
  for (const lesson of lessons) {
    const content = typeof lesson === 'string' ? lesson : lesson && typeof lesson === 'object' && typeof (lesson as { content?: unknown }).content === 'string' ? (lesson as { content: string }).content : undefined;
    if (content?.trim()) dreamState.addLesson(agentId, content.trim(), 'dream_cycle', runId);
  }
};
const remArchiveInput = (lesson: ManagedLesson): KnowledgeInput => ({
  source_type: 'lesson', source_id: lesson.id, archive_schema: '0g-dream-memory/v1',
  payload: {
    lesson_id: lesson.id, run_id: lesson.run_id, state: lesson.state, content: lesson.content,
    source: lesson.source, created_at: lesson.created_at,
  },
});
/** Builds canonical REM records for both newly promoted and historic lessons. */
const promotedRemArchiveInputs = (agentId: string): KnowledgeInput[] =>
  dreamState.listLessons(agentId)
    .filter((lesson) => lesson.state === 'PROMOTED_CONSTRAINT')
    .map(remArchiveInput);
const dreamRunArchiveInput = (run: DreamRun): KnowledgeInput => ({
  source_type: 'dream_run', source_id: run.id, archive_schema: '0g-dream-memory/v1',
  payload: {
    run_id: run.id, state: run.status, completed_at: run.completed_at, created_at: run.created_at,
    source: run.source, learning_brief: run.learning_brief,
    evidence_proof: run.settlement?.status === 'settled' ? { xrpl_payment_tx: run.settlement.transaction_hash, payment_session_id: run.settlement.quote_id, settlement_rail: 'x402-xrpl-rlusd' } : undefined,
  },
});
const queueDreamAudit = (run: DreamRun | undefined): void => { if (run && (run.status === 'completed' || run.status === 'failed')) { enqueueKnowledge(run.openx_agent_id, dreamRunArchiveInput(run)); const job = auditorService.queueDreamAudit(run.openx_agent_id, run.id); if (job.status === 'queued') void auditorService.processDreamAudit(job.id); } };

const respondMcpError = (res: Response, error: unknown): void => {
  if (error instanceof McpError) { res.status(error.status === 402 ? 402 : error.status >= 400 ? error.status : 502).json({ ok: false, ...(typeof error.data === 'object' && error.data ? error.data as object : { error: 'hypermove_error', message: String(error.data) }) }); return; }
  res.status(502).json({ ok: false, error: 'hypermove_error', message: error instanceof Error ? error.message : 'Unable to reach HyperMove' });
};
const serviceMcpToken = (): string | undefined => process.env.HYPERMOVE_MCP_SERVICE_TOKEN?.trim() || undefined;
const mcpTokenFor = (agentId: string): string => {
  const token = serviceMcpToken() || dreamState.getMcpToken(agentId);
  if (!token) throw new McpError(409, { error: 'mcp_token_not_configured', message: 'Connect this agent’s own HyperMove bearer token first' });
  return token;
};
/** Explicit opt-in: public Portal setup uses the server-held HyperMove credential. */
const portalManagedDreamSetupEnabled = (): boolean => Boolean(serviceMcpToken()) && (
  process.env.OPENX_DREAM_PUBLIC_SETUP_ENABLED === 'true'
  || (process.env.OPENX_AGENT_REGISTRATION_MODE !== 'production' && process.env.OPENX_DREAM_SELF_SERVICE_ENABLED === 'true')
);
const agentKeyFor = (req: Request): string | undefined => typeof req.headers['x-agent-key'] === 'string' ? req.headers['x-agent-key'] : undefined;
const hasDreamCredentialAuthority = (req: Request, agentId: string): boolean => {
  const adminToken = process.env.OPENX_DREAM_CREDENTIAL_ADMIN_TOKEN;
  const agentKey = agentKeyFor(req);
  return Boolean(agentKey && agentRegistry.authorizeTelemetry(agentId, agentKey)) || Boolean(adminToken && req.headers.authorization === `Bearer ${adminToken}`);
};
const hasArchiveAdminAuthority = (req: Request): boolean => {
  const adminToken = process.env.OPENX_DREAM_CREDENTIAL_ADMIN_TOKEN;
  return Boolean(adminToken && req.headers.authorization === `Bearer ${adminToken}`);
};
const dreamReconciliationTimers = new Set<string>();
const dreamTerminalStatus = (value: unknown): 'completed' | 'failed' | undefined => {
  if (value === 'completed' || value === 'partial') return 'completed';
  if (value === 'failed' || value === 'error') return 'failed';
  return undefined;
};
const hasCompletedDreamEvidence = (result: unknown): boolean => {
  const data = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  return dreamTerminalStatus(data.status) === 'completed'
    || Boolean(data.stage_summaries)
    || typeof data.memories_count === 'number';
};
const dreamResultFingerprint = (agentId: string, hypermoveAgentId: string, result: unknown): string => {
  const data = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const stableEvidence = {
    agent_id: agentId,
    hypermove_agent_id: hypermoveAgentId,
    run_id: typeof data.run_id === 'string' ? data.run_id : null,
    status: typeof data.status === 'string' ? data.status : null,
    stage_summaries: data.stage_summaries ?? null,
    memories_count: typeof data.memories_count === 'number' ? data.memories_count : null,
    daily_digest: typeof data.daily_digest === 'string' ? data.daily_digest : null,
    morning_brief: typeof data.morning_brief === 'string' ? data.morning_brief : null,
  };
  return createHash('sha256').update(JSON.stringify(stableEvidence)).digest('hex');
};
const syncCompletedDreamRun = async (agentId: string): Promise<{ run: DreamRun; imported: boolean }> => {
  const link = dreamState.getLink(agentId);
  if (!link) throw new McpError(409, { error: 'dream_not_linked', message: 'Link this agent to HyperMove before syncing Dream data' });
  const result = await hyperMove.call('get_dream_stats', { agent_id: link.hypermove_agent_id }, mcpTokenFor(agentId));
  if (!hasCompletedDreamEvidence(result)) {
    throw new McpError(409, { error: 'upstream_completion_not_available', message: 'HyperMove has not reported a completed Dream result for this agent yet' });
  }
  const imported = dreamState.importCompletedRun(agentId, link, result, learningBriefFrom(result), dreamResultFingerprint(agentId, link.hypermove_agent_id, result));
  persistDreamLessons(agentId, imported.run.id, result);
  if (imported.created) queueDreamAudit(imported.run);
  return { run: imported.run, imported: imported.created };
};
const reconcileDreamRun = async (run: DreamRun): Promise<DreamRun | undefined> => {
  if (run.status !== 'running') return run;
  const checkedAt = new Date().toISOString();
  try {
    const result = await hyperMove.call('get_dream_stats', { agent_id: run.hypermove_agent_id }, mcpTokenFor(run.openx_agent_id));
    const upstreamStatus = typeof result?.status === 'string' ? result.status : undefined;
    const terminal = dreamTerminalStatus(upstreamStatus);
    if (terminal === 'completed') {
      persistDreamLessons(run.openx_agent_id, run.id, result);
      const updated = dreamState.updateRun(run.id, { status: 'completed', completed_at: checkedAt, result, learning_brief: learningBriefFrom(result), reconciliation: { last_checked_at: checkedAt, upstream_status: upstreamStatus } }); queueDreamAudit(updated); return updated;
    }
    if (terminal === 'failed') {
      const updated = dreamState.updateRun(run.id, { status: 'failed', completed_at: checkedAt, result, error: typeof result?.error === 'string' ? result.error : 'HyperMove Dream run failed', reconciliation: { last_checked_at: checkedAt, upstream_status: upstreamStatus } }); queueDreamAudit(updated); return updated;
    }
    if (hasCompletedDreamEvidence(result)) {
      persistDreamLessons(run.openx_agent_id, run.id, result);
      const updated = dreamState.updateRun(run.id, { status: 'completed', completed_at: checkedAt, result, learning_brief: learningBriefFrom(result), reconciliation: { last_checked_at: checkedAt, upstream_status: 'completed' } }); queueDreamAudit(updated); return updated;
    }
    return dreamState.updateRun(run.id, { reconciliation: { last_checked_at: checkedAt, ...(upstreamStatus ? { upstream_status: upstreamStatus } : {}), ...(upstreamStatus ? {} : { last_error: 'HyperMove did not return a terminal Dream status' }) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reconcile Dream status';
    return dreamState.updateRun(run.id, { reconciliation: { last_checked_at: checkedAt, last_error: message } });
  }
};
const scheduleDreamReconciliation = (runId: string, delayMs = 5_000): void => {
  if (dreamReconciliationTimers.has(runId)) return;
  dreamReconciliationTimers.add(runId);
  const timer = setTimeout(async () => {
    dreamReconciliationTimers.delete(runId);
    const run = dreamState.getRun(runId);
    if (!run) return;
    const reconciled = await reconcileDreamRun(run);
    if (reconciled?.status === 'running') scheduleDreamReconciliation(runId);
  }, delayMs);
  timer.unref();
};
const resumeDreamReconciliation = (): void => {
  for (const run of dreamState.runningRuns()) scheduleDreamReconciliation(run.id, 0);
};
const skillIdForCapability = (capability: string): string => `capability:${capability}`;
const projectSkills = (agentId: string) => {
  const agent = agentRegistry.get(agentId);
  if (!agent) return undefined;
  const capabilities = agent.capabilities.map((capability) => {
    const id = skillIdForCapability(capability);
    return { id, name: capability, slug: capability, description: 'Capability reported by the connected agent.', status: agentIngestionStore.getSkillStatus(agentId, id) || 'active', version: 'reported', trigger_patterns: [capability], audit_last_run: null, audit_score: null, created_at: agent.registered_at, author: agent.display_name, source: 'local', telemetry: agentIngestionStore.getExecutionMetrics(agentId, capability) };
  });
  const candidates = agentIngestionStore.getCandidateSkills(agentId).map((candidate) => ({
    id: candidate.id, name: candidate.display_name, slug: candidate.skill_slug, description: `Candidate skill for ${candidate.capability_ids.join(', ') || 'connected agent capabilities'}.`, status: agentIngestionStore.getSkillStatus(agentId, candidate.id) || 'in_audit', version: 'candidate', trigger_patterns: candidate.capability_ids, audit_last_run: null, audit_score: null, created_at: candidate.received_at, author: agent.display_name, source: 'local', telemetry: agentIngestionStore.getExecutionMetrics(agentId, candidate.skill_slug),
  }));
  return [...candidates, ...capabilities];
};

/** Public, intentionally minimal data contracts for browser-local WebMCP tools. */
const webMcpAgent = (agent: ReturnType<typeof agentRegistry.get>) => agent && ({
  agent_id: agent.agent_id, display_name: agent.display_name, slug: agent.slug,
  description: agent.description, model: agent.model, capabilities: agent.capabilities,
  host_type: agent.host_type, state: agent.state, registered_at: agent.registered_at,
  last_seen_at: agent.last_seen_at,
});
const webMcpActivity = (agentId: string) => {
  const activity = agentIngestionStore.getTaskActivity(agentId);
  const project = (task: typeof activity.current_task) => task && ({ task_id: task.task_id, state: task.state, title: task.title, phase: task.phase, progress_pct: task.progress_pct, model: task.model, tools_used: task.tools_used, last_heartbeat_at: task.last_heartbeat_at });
  return { current_task: project(activity.current_task), latest_task: project(activity.latest_task) };
};
const webMcpDream = (agentId: string) => {
  const link = dreamState.getLink(agentId);
  const run = dreamState.latestRun(agentId);
  return { linked: Boolean(link), hypermove_agent_id: link?.hypermove_agent_id || null, latest_run: run ? { id: run.id, status: run.status, completed_at: run.completed_at || null, source: run.source || 'gateway', learning_brief: run.learning_brief } : null };
};
const webMcpAuditor = (agentId: string) => {
  auditorService.ensureAgentWorkspace(agentId);
  const jobs = auditorService.listDreamJobs(agentId);
  const latest = jobs[0];
  const workspace = latest ? auditorService.workspace(agentId, latest.id) : undefined;
  return { latest_job: latest ? { id: latest.id, status: latest.status, dream_run_id: latest.dream_run_id, created_at: latest.created_at, updated_at: latest.updated_at } : null, reviewed_lessons: workspace?.lessons.map((lesson) => ({ id: lesson.id, state: lesson.state, source: lesson.source, created_at: lesson.created_at })) || [], evidence: workspace?.evidence || null };
};
const webMcpConnectionPrompt = (agentId: string, agentKey: string | undefined): string => [
  'Connect this agent to OpenX Gateway and keep the issued identity for all future syncs.',
  `OPENX_AGENT_ID=${agentId}`,
  ...(agentKey ? [`OPENX_AGENT_KEY=${agentKey}`] : []),
  `OPENX_GATEWAY_URL=${(process.env.OPENX_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}`,
  'Send authenticated POST /v1/agent/sync heartbeats and POST /v1/agent/telemetry task lifecycle updates. Do not register again when these values already exist.',
].join('\n');
const registerWebMcpAgent = (req: Request, res: Response): void => {
  const parsed = AgentRegisterSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload', message: parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ') }); return; }
  try {
    const result = agentRegistry.register(parsed.data);
    auditorService.ensureAgentWorkspace(result.agent.agent_id);
    const knowledge_sync = syncConnectedAgentKnowledge(result.agent.agent_id);
    res.status(result.created ? 201 : 200).json({ ok: true, status: result.created ? 'registered' : 'restored', agent: webMcpAgent(result.agent), knowledge_sync, credential: result.credential ? { agent_key: result.credential, shown_once: true } : undefined, connection_prompt: webMcpConnectionPrompt(result.agent.agent_id, result.credential), telemetry_endpoint: `${(process.env.OPENX_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}/v1/agent/telemetry` });
  } catch (error) {
    if (error instanceof AgentRegistryError) { res.status(error.status).json({ ok: false, error: error.code, message: error.code.replace(/_/g, ' ') }); return; }
    res.status(500).json({ ok: false, error: 'internal_error', message: 'Unable to register agent' });
  }
};

const runDailyAudits = (): void => {
  for (const agent of agentRegistry.list()) auditorService.audit(agent.agent_id, 'daily');
};
const shouldRunGateway = Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
if (shouldRunGateway && process.env.NODE_ENV !== 'test') {
  const dailyAuditTimer = setInterval(runDailyAudits, 24 * 60 * 60 * 1000);
  dailyAuditTimer.unref();
  const dreamAuditTimer = setInterval(() => { void auditorService.processDueDreamAudits(); }, 60_000);
  dreamAuditTimer.unref();
  void auditorService.processDueDreamAudits();
  resumeDreamReconciliation();
}

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'openx-deep-research-analyst-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    knowledge_storage: agentKnowledgeArchive.health(),
    ...agentRegistry.health(),
  });
});

const canReadUsageSummary = (req: Request, agentId?: string): boolean => {
  if (process.env.OPENX_AGENT_REGISTRATION_MODE !== 'production') return true;
  if (agentId) {
    const agentKey = req.headers['x-agent-key'];
    return agentRegistry.authorizeTelemetry(agentId, typeof agentKey === 'string' ? agentKey : undefined);
  }
  const configuredReadToken = process.env.OPENX_USAGE_READ_TOKEN;
  const authorization = req.headers.authorization;
  return Boolean(configuredReadToken && authorization === `Bearer ${configuredReadToken}`);
};

/** Builds a complete, idempotent local snapshot when an agent is connected or restored. */
const syncConnectedAgentKnowledge = (agentId: string) => {
  const agent = agentRegistry.get(agentId);
  if (!agent) return undefined;
  const inputs: KnowledgeInput[] = [{ source_type: 'agent_profile', source_id: agent.agent_id, payload: agent }];
  for (const item of agentIngestionStore.getTelemetry(agentId, 100)) inputs.push({ source_type: 'telemetry', source_id: item.id, payload: item });
  for (const item of agentIngestionStore.getMemoryEpisodes(agentId)) inputs.push({ source_type: 'memory_episode', source_id: item.id, payload: item });
  for (const item of agentIngestionStore.getCandidateSkills(agentId)) inputs.push({ source_type: 'skill_metadata', source_id: item.id, payload: item });
  for (const item of dreamState.listRuns(agentId)) inputs.push({ source_type: 'dream_run', source_id: item.id, payload: item });
  for (const item of dreamState.listLessons(agentId)) inputs.push({ source_type: 'lesson', source_id: item.id, payload: item });
  // Generic lesson evidence predates REM provenance. Include the immutable REM
  // envelope so reconnects and operator syncs backfill historic promotions.
  inputs.push(...promotedRemArchiveInputs(agentId));
  for (const item of auditorService.list(agentId, 100)) inputs.push({ source_type: 'audit', source_id: item.id, payload: item });
  try { inputs.push({ source_type: 'usage_summary', source_id: new Date().toISOString().slice(0, 7), payload: usageLedger.summary(agentId) }); } catch { /* Production usage configuration is independent of archive sync. */ }
  return agentKnowledgeArchive.sync(agentId, inputs);
};
const enqueueKnowledge = (agentId: string, input: KnowledgeInput): void => {
  agentKnowledgeArchive.enqueue(agentId, input);
  void agentKnowledgeArchive.processPending(agentId);
};

app.post('/v1/agent/register', (req: Request, res: Response): void => {
  const parsed = AgentRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_payload', message: parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ') });
    return;
  }
  try {
    const credential = req.headers['x-agent-key'];
    const result = agentRegistry.register(parsed.data, typeof credential === 'string' ? credential : undefined);
    auditorService.ensureAgentWorkspace(result.agent.agent_id);
    const knowledge_sync = syncConnectedAgentKnowledge(result.agent.agent_id);
    res.status(result.created ? 201 : 200).json({
      ok: true,
      status: 'registered',
      agent: result.agent,
      knowledge_sync,
      ...(result.credential ? { credential: { agent_key: result.credential, shown_once: true } } : {}),
      telemetry_endpoint: `${(process.env.OPENX_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}/v1/agent/telemetry`,
    });
  } catch (error) {
    if (error instanceof AgentRegistryError) {
      res.status(error.status).json({ ok: false, error: error.code, message: error.code.replace(/_/g, ' ') });
      return;
    }
    res.status(500).json({ ok: false, error: 'internal_error', message: 'Unable to register agent' });
  }
});

/** Reconnect an existing local agent after its host configuration is restored. */
app.post('/v1/agent/claim', (req: Request, res: Response): void => {
  const parsed = AgentClaimSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  try {
    const agent = agentRegistry.claim(parsed.data.agent_id, parsed.data.agent_key);
    auditorService.ensureAgentWorkspace(agent.agent_id);
    const knowledge_sync = syncConnectedAgentKnowledge(agent.agent_id);
    res.json({ ok: true, agent, knowledge_sync, sync_endpoint: `${(process.env.OPENX_API_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}/v1/agent/sync` });
  } catch (error) {
    if (error instanceof AgentRegistryError) { res.status(error.status).json({ ok: false, error: error.code }); return; }
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

app.get('/v1/agents', (req: Request, res: Response): void => {
  const includeRevoked = req.query.include === 'revoked';
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const agents = agentRegistry.list(includeRevoked).filter((agent) => !state || agent.state === state);
  res.json({ ok: true, count: agents.length, agents });
});

/** Metadata-only process projection for the Studio Hub. Keep before :agentId. */
app.get('/v1/agents/activity', (_req: Request, res: Response): void => {
  const agents = agentRegistry.list();
  res.json({
    ok: true,
    agents: agents.map((agent) => ({
      agent_id: agent.agent_id,
      state: agent.state,
      last_seen_at: agent.last_seen_at,
      activity: agentIngestionStore.getTaskActivity(agent.agent_id),
    })),
  });
});

/** Single truthful projection for the Studio Hub; keep before /:agentId routes. */
app.get('/v1/agents/overview', (_req: Request, res: Response): void => {
  const agents = agentRegistry.list();
  const overview = agents.map((agent) => {
    const link = dreamState.getLink(agent.agent_id);
    const jobs = auditorService.listDreamJobs(agent.agent_id);
    return {
      agent,
      connection: { state: agent.state, last_seen_at: agent.last_seen_at },
      dream: (() => {
        const run = dreamState.latestRun(agent.agent_id);
        return {
          linked: Boolean(link),
          hypermove_agent_id: link?.hypermove_agent_id || null,
          ...(run ? { latest_run: { id: run.id, status: run.status, completed_at: run.completed_at || null, source: run.source || 'gateway', learning_brief: run.learning_brief } } : {}),
        };
      })(),
      activity: agentIngestionStore.getTaskActivity(agent.agent_id),
      audit: { ready: jobs.some((job) => job.dream_run_id === `agent:${agent.agent_id}`), job_count: jobs.length },
      knowledge_sync: agentKnowledgeArchive.status(agent.agent_id),
    };
  });
  res.json({ ok: true, agents: overview, summary: { registered: overview.length, online: overview.filter((item) => item.connection.state === 'online').length, linked: overview.filter((item) => item.dream.linked).length, auditor_ready: overview.filter((item) => item.audit.ready).length } });
});

/**
 * WebMCP is browser-local tool registration, not a second control plane. These
 * endpoints are the intentionally public, reduced projections selected for the
 * GPT integration. Existing authenticated agent-host endpoints stay unchanged.
 */
app.get('/v1/webmcp/agents', (_req: Request, res: Response): void => {
  const agents = agentRegistry.list().map(webMcpAgent).filter(Boolean);
  res.json({ ok: true, agents, summary: { registered: agents.length, online: agents.filter((agent) => agent?.state === 'online').length } });
});
app.post('/v1/webmcp/agents', registerWebMcpAgent);
app.get('/v1/webmcp/agents/:agentId', (req: Request, res: Response): void => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, agent: webMcpAgent(agent), activity: webMcpActivity(agent.agent_id), dream: webMcpDream(agent.agent_id), knowledge_sync: agentKnowledgeArchive.status(agent.agent_id) });
});
app.get('/v1/webmcp/agents/:agentId/skills', (req: Request, res: Response): void => {
  const skills = projectSkills(req.params.agentId);
  if (!skills) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, skills: skills.map(({ id, name, slug, description, status, version, trigger_patterns, telemetry }) => ({ id, name, slug, description, status, version, trigger_patterns, telemetry })) });
});
app.post('/v1/webmcp/agents/:agentId/skills/:skillId/status', (req: Request, res: Response): void => {
  const parsed = SkillStatusSchema.safeParse(req.body);
  const skill = projectSkills(req.params.agentId)?.find((item) => item.id === req.params.skillId);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  if (!skill) { res.status(404).json({ ok: false, error: 'skill_not_found' }); return; }
  agentIngestionStore.setSkillStatus(req.params.agentId, req.params.skillId, parsed.data.status as SkillLifecycleStatus);
  res.json({ ok: true, skill: { id: skill.id, name: skill.name, status: parsed.data.status } });
});
app.get('/v1/webmcp/agents/:agentId/wallet', async (req: Request, res: Response): Promise<void> => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const wallet = await walletService.snapshot(agent.wallet_address || agent.owner_address);
  res.json({ ok: true, wallet: { address: wallet.address, chain_id: wallet.chain_id, network: wallet.network, native_balance_wei: wallet.native_balance_wei, tokens: wallet.tokens, fetched_at: wallet.fetched_at, source_errors: wallet.source_errors } });
});
app.get('/v1/webmcp/agents/:agentId/dream', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, dream: webMcpDream(req.params.agentId) });
});
app.post('/v1/webmcp/agents/:agentId/dream/trigger', (req: Request, res: Response): void => {
  // The canonical handler preserves payment, idempotency, and reconciliation semantics.
  req.url = `/v1/agents/${encodeURIComponent(req.params.agentId)}/dream/trigger`;
  (app as unknown as { handle: (request: Request, response: Response) => void }).handle(req, res);
});
app.get('/v1/webmcp/agents/:agentId/auditor', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, auditor: webMcpAuditor(req.params.agentId) });
});
app.post('/v1/webmcp/agents/:agentId/auditor/chat', async (req: Request, res: Response): Promise<void> => {
  const parsed = AuditorChatSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const latest = auditorService.listDreamJobs(req.params.agentId)[0];
  if (!latest) { res.status(409).json({ ok: false, error: 'audit_unavailable' }); return; }
  try {
    const result = await auditorService.chat(req.params.agentId, latest.id, parsed.data.message, parsed.data.client_request_id, req.ip || 'unknown');
    if (result.error === 'not_found') { res.status(404).json({ ok: false, error: 'audit_not_found' }); return; }
    if (result.error === 'rate_limited') { res.status(429).json({ ok: false, error: 'chat_rate_limited' }); return; }
    if (result.error === 'no_evidence') { res.status(409).json({ ok: false, error: 'audit_evidence_unavailable' }); return; }
    if (result.error === 'not_configured') { res.status(503).json({ ok: false, error: 'auditor_chat_unavailable' }); return; }
    res.status(201).json({ ok: true, audit_job_id: latest.id, turn: result.turn });
  } catch { res.status(502).json({ ok: false, error: 'auditor_chat_unavailable' }); }
});

/** Agent-owned periodic sync. No gateway-initiated connection to agent hosts. */
app.post('/v1/agent/sync', (req: Request, res: Response): void => {
  const parsed = AgentSyncSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  const agentKey = req.headers['x-agent-key'];
  if (!agentRegistry.authorizeTelemetry(parsed.data.agent_id, typeof agentKey === 'string' ? agentKey : undefined)) { res.status(401).json({ ok: false, error: 'invalid_agent_key' }); return; }
  try {
    const agent = agentRegistry.recordHeartbeat(parsed.data.agent_id, { model: parsed.data.model, capabilities: [...parsed.data.tools, ...parsed.data.skills] });
    res.status(200).json({ ok: true, agent, synchronized_at: new Date().toISOString() });
  } catch (error) {
    if (error instanceof AgentRegistryError) { res.status(error.status).json({ ok: false, error: error.code }); return; }
    res.status(500).json({ ok: false, error: 'internal_error' });
  }
});

app.get('/v1/agents/:agentId', (req: Request, res: Response): void => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) {
    res.status(404).json({ ok: false, error: 'agent_not_found', message: 'Agent is not registered' });
    return;
  }
  res.json({ ok: true, agent, activity: agentIngestionStore.getLiveAgentDelta(agent.agent_id), task_activity: agentIngestionStore.getTaskActivity(agent.agent_id), knowledge_sync: agentKnowledgeArchive.status(agent.agent_id) });
});

app.get('/v1/agents/:agentId/knowledge-sync', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, sync: agentKnowledgeArchive.status(req.params.agentId), storage: agentKnowledgeArchive.health() });
});

app.post('/v1/agents/:agentId/knowledge-sync', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  if (!agentKeyFor(req) || !agentRegistry.authorizeTelemetry(req.params.agentId, agentKeyFor(req))) { res.status(401).json({ ok: false, error: 'invalid_agent_key' }); return; }
  res.status(202).json({ ok: true, sync: syncConnectedAgentKnowledge(req.params.agentId) });
});

app.post('/v1/admin/knowledge-sync', async (req: Request, res: Response): Promise<void> => {
  if (!hasArchiveAdminAuthority(req)) { res.status(401).json({ ok: false, error: 'admin_authorization_required' }); return; }
  if (agentKnowledgeArchive.health().state !== 'ready') { res.status(409).json({ ok: false, error: 'knowledge_storage_not_ready', storage: agentKnowledgeArchive.health() }); return; }
  const agents = agentRegistry.list();
  const retried_records = agentKnowledgeArchive.retryPending();
  for (const agent of agents) syncConnectedAgentKnowledge(agent.agent_id);
  await agentKnowledgeArchive.flush();
  const results = agents.map((agent) => ({ agent_id: agent.agent_id, display_name: agent.display_name, sync: agentKnowledgeArchive.status(agent.agent_id), records: agentKnowledgeArchive.records(agent.agent_id) }));
  res.json({ ok: true, message: 'All connected-agent data was sanitized and published to 0G Storage.', storage: agentKnowledgeArchive.health(), agent_count: results.length, retried_records, results });
});

/** Replays only historic promoted REM lessons without changing their lifecycle state. */
app.post('/v1/admin/0g-rem-backfill', async (req: Request, res: Response): Promise<void> => {
  if (!hasArchiveAdminAuthority(req)) { res.status(401).json({ ok: false, error: 'admin_authorization_required' }); return; }
  if (agentKnowledgeArchive.health().state !== 'ready') { res.status(409).json({ ok: false, error: 'knowledge_storage_not_ready', storage: agentKnowledgeArchive.health() }); return; }
  const results = agentRegistry.list().map((agent) => {
    const inputs = promotedRemArchiveInputs(agent.agent_id);
    agentKnowledgeArchive.sync(agent.agent_id, inputs);
    return { agent_id: agent.agent_id, queued_rem_lessons: inputs.length };
  });
  await agentKnowledgeArchive.flush();
  res.json({ ok: true, message: 'Historic promoted REM lessons were queued for 0G Storage publication.', storage: agentKnowledgeArchive.health(), queued_rem_lessons: results.reduce((total, item) => total + item.queued_rem_lessons, 0), results: results.map((item) => ({ ...item, sync: agentKnowledgeArchive.status(item.agent_id) })) });
});

app.get('/v1/agents/:agentId/activity', (req: Request, res: Response): void => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const limit = Number(req.query.limit) || 20;
  res.json({ ok: true, agent_id: agent.agent_id, activity: agentIngestionStore.getTaskActivity(agent.agent_id), history: agentIngestionStore.getTaskHistory(agent.agent_id, limit) });
});

/** Connected-agent capability and candidate-skill catalog; intentionally metadata-only. */
app.get('/v1/agents/:agentId/skills', (req: Request, res: Response): void => {
  const skills = projectSkills(req.params.agentId);
  if (!skills) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, agent_id: req.params.agentId, skills });
});

app.post('/v1/agents/:agentId/skills/:skillId/status', (req: Request, res: Response): void => {
  const parsed = SkillStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  if (!agentKeyFor(req) || !agentRegistry.authorizeTelemetry(req.params.agentId, agentKeyFor(req))) { res.status(401).json({ ok: false, error: 'invalid_agent_key' }); return; }
  const skill = projectSkills(req.params.agentId)?.find((item) => item.id === req.params.skillId);
  if (!skill) { res.status(404).json({ ok: false, error: 'skill_not_found' }); return; }
  agentIngestionStore.setSkillStatus(req.params.agentId, req.params.skillId, parsed.data.status as SkillLifecycleStatus);
  res.json({ ok: true, skill: { ...skill, status: parsed.data.status } });
});

/** Read-only agent wallet balance, configured token, and explorer activity snapshot. */
app.get('/v1/agents/:agentId/wallet', async (req: Request, res: Response): Promise<void> => {
  const agent = agentRegistry.get(req.params.agentId);
  if (!agent) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, agent_id: agent.agent_id, wallet: await walletService.snapshot(agent.wallet_address || agent.owner_address) });
});

app.get('/v1/agents/:agentId/audits', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  auditorService.ensureAgentWorkspace(req.params.agentId);
  res.json({ ok: true, audits: auditorService.list(req.params.agentId, Number(req.query.limit) || 20), dream_jobs: auditorService.listDreamJobs(req.params.agentId) });
});

/** Public, evidence-only review workspace. It deliberately contains no credentials or raw model traces. */
app.get('/v1/agents/:agentId/audits/:auditJobId/workspace', (req: Request, res: Response): void => {
  const workspace = auditorService.workspace(req.params.agentId, req.params.auditJobId);
  if (!workspace) { res.status(404).json({ ok: false, error: 'audit_not_found' }); return; }
  res.json({ ok: true, workspace });
});

/** SSE emits persisted phase events, not model chain-of-thought. */
app.get('/v1/agents/:agentId/audits/:auditJobId/events', (req: Request, res: Response): void => {
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const sentEventIds = new Set<string>();
  const write = () => {
    const workspace = auditorService.workspace(req.params.agentId, req.params.auditJobId);
    if (!workspace) { res.write(`event: error\ndata: ${JSON.stringify({ error: 'audit_not_found' })}\n\n`); res.end(); return; }
    const events = workspace.events.filter((event) => !sentEventIds.has(event.id));
    for (const event of events) { res.write(`event: audit_event\ndata: ${JSON.stringify(event)}\n\n`); sentEventIds.add(event.id); }
    res.write(`event: workspace\ndata: ${JSON.stringify({ job: workspace.job, events: workspace.events })}\n\n`);
    if (workspace.job.status === 'completed' || workspace.job.status === 'not_configured') res.end();
  };
  write(); const timer = setInterval(write, 1500); req.on('close', () => clearInterval(timer));
});

/** Public visitor Q&A is rate-limited and cannot mutate lessons, skills, or agent state. */
app.post('/v1/agents/:agentId/audits/:auditJobId/chat', async (req: Request, res: Response): Promise<void> => {
  const parsed = AuditorChatSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  try {
    const result = await auditorService.chat(req.params.agentId, req.params.auditJobId, parsed.data.message, parsed.data.client_request_id, req.ip || 'unknown');
    if (result.error === 'not_found') { res.status(404).json({ ok: false, error: 'audit_not_found' }); return; }
    if (result.error === 'rate_limited') { res.status(429).json({ ok: false, error: 'chat_rate_limited', message: 'Try again later.' }); return; }
    if (result.error === 'no_evidence') { res.status(409).json({ ok: false, error: 'audit_evidence_unavailable', message: 'This audit has no reviewed lessons yet.' }); return; }
    if (result.error === 'not_configured') { res.status(503).json({ ok: false, error: 'auditor_chat_unavailable' }); return; }
    res.status(201).json({ ok: true, turn: result.turn });
  } catch (error) {
    res.status(502).json({ ok: false, error: 'auditor_chat_unavailable', message: 'The auditor returned an invalid answer. Please try again.' });
  }
});

app.post('/v1/agents/:agentId/audits', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const agentKey = req.headers['x-agent-key'];
  if (!agentRegistry.authorizeTelemetry(req.params.agentId, typeof agentKey === 'string' ? agentKey : undefined)) { res.status(401).json({ ok: false, error: 'invalid_agent_key' }); return; }
  res.status(201).json({ ok: true, audit: auditorService.audit(req.params.agentId, 'manual') });
});

/** XRPL Testnet service-payment verification. This route never creates balances or withdrawals. */
app.get('/v1/settlement/xrpl-testnet', (_req: Request, res: Response): void => {
  const config = xrplTestnetSettlement.config();
  res.json({ ok: true, network: 'xrpl-testnet', configured: xrplTestnetSettlement.isConfigured(), currency: config.currency, issuer_configured: Boolean(config.issuer), destination_configured: Boolean(config.destination), service_payment_only: true });
});

app.post('/v1/settlement/xrpl-testnet/verify', async (req: Request, res: Response): Promise<void> => {
  const parsed = XrplSettlementProofSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  const result = await xrplTestnetSettlement.verifyServicePayment(parsed.data.transaction_hash, parsed.data.expected_amount);
  res.status(result.verified ? 200 : 409).json({ ok: result.verified, ...result, service_payment_only: true });
});

app.post('/v1/agents/:agentId/dream/link', async (req: Request, res: Response): Promise<void> => {
  const parsed = DreamLinkSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  try {
    const owned = await hyperMove.call('list_my_dream_agent_ids', {}, mcpTokenFor(req.params.agentId));
    const ids = Array.isArray(owned) ? owned : owned.agent_ids || owned.ids || [];
    if (!ids.includes(parsed.data.hypermove_agent_id)) { res.status(403).json({ ok: false, error: 'dream_agent_not_owned' }); return; }
    res.status(201).json({ ok: true, link: dreamState.link(req.params.agentId, parsed.data.hypermove_agent_id) });
  } catch (error) { respondMcpError(res, error); }
});

app.put('/v1/agents/:agentId/dream/credential', (req: Request, res: Response): void => {
  const parsed = DreamCredentialSchema.safeParse(req.body);
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  if (!hasDreamCredentialAuthority(req, req.params.agentId)) { res.status(401).json({ ok: false, error: 'invalid_dream_credential_authorization' }); return; }
  try { dreamState.setMcpToken(req.params.agentId, parsed.data.token); res.status(204).end(); } catch (error) { respondMcpError(res, error); }
});

app.get('/v1/agents/:agentId/dream/readiness', async (req: Request, res: Response): Promise<void> => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const usingServiceCredential = Boolean(serviceMcpToken());
  const hasCredential = usingServiceCredential || dreamState.hasMcpToken(req.params.agentId);
  const configured = Boolean(process.env.HYPERMOVE_MCP_URL);
  const vaultConfigured = dreamState.isTokenVaultConfigured();
  const link = dreamState.getLink(req.params.agentId) || null;
  const portalSetupEnabled = portalManagedDreamSetupEnabled();
  if (!configured || (!usingServiceCredential && !vaultConfigured) || !hasCredential || (usingServiceCredential && !portalSetupEnabled)) {
    const error = !configured ? 'hypermove_unavailable' : !usingServiceCredential && !vaultConfigured ? 'token_vault_unconfigured' : !hasCredential ? 'mcp_token_not_configured' : 'dream_public_setup_disabled';
    const message = !configured ? 'Configure HYPERMOVE_MCP_URL before Dream setup.' : !usingServiceCredential && !vaultConfigured ? 'Configure OPENX_DREAM_TOKEN_ENCRYPTION_KEY before credential setup.' : !hasCredential ? 'Configure HYPERMOVE_MCP_SERVICE_TOKEN for Portal one-click setup or provide an agent credential.' : 'Set OPENX_DREAM_PUBLIC_SETUP_ENABLED=true to allow Portal-managed Dream setup.';
    res.json({ ok: true, ready: false, has_token: hasCredential, token_vault_configured: vaultConfigured, using_service_credential: usingServiceCredential, self_service_enabled: portalManagedDreamSetupEnabled(), hypermove_mcp_configured: configured, is_linked: Boolean(link), link, error, message });
    return;
  }
  try {
    const readiness = await hyperMove.call('get_dream_readiness', { agent_id: link?.hypermove_agent_id || req.params.agentId }, mcpTokenFor(req.params.agentId));
    res.json({ ok: true, ready: Boolean(readiness?.ready ?? true), has_token: true, token_vault_configured: vaultConfigured, using_service_credential: usingServiceCredential, self_service_enabled: portalManagedDreamSetupEnabled(), hypermove_mcp_configured: true, is_linked: Boolean(link), link, readiness });
  } catch (error) { respondMcpError(res, error); }
});

/**
 * One-click Dream setup. HyperMove claims a stable agent_id on the first
 * episode or run, so a connected OpenX agent can use its existing UUID.
 */
app.post('/v1/agents/:agentId/dream/setup', async (req: Request, res: Response): Promise<void> => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const parsed = DreamSetupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  const selfService = portalManagedDreamSetupEnabled() && !parsed.data.token;
  if (!selfService && (!parsed.data.token || !hasDreamCredentialAuthority(req, req.params.agentId))) { res.status(401).json({ ok: false, error: portalManagedDreamSetupEnabled() ? 'invalid_dream_credential_authorization' : 'dream_self_service_disabled', message: portalManagedDreamSetupEnabled() ? 'Provide the one-time agent key or an authorized operator token.' : 'One-click setup requires HYPERMOVE_MCP_URL, HYPERMOVE_MCP_SERVICE_TOKEN, and OPENX_DREAM_PUBLIC_SETUP_ENABLED=true.' }); return; }
  try {
    const hypermoveAgentId = parsed.data.hypermove_agent_id || req.params.agentId;
    // Validate before persistence: a rejected agent token must not alter credential or link state.
    const token = selfService ? serviceMcpToken()! : parsed.data.token!;
    const readiness = await hyperMove.call('get_dream_readiness', { agent_id: hypermoveAgentId }, token);
    if (!selfService) dreamState.setMcpToken(req.params.agentId, token);
    const link = dreamState.link(req.params.agentId, hypermoveAgentId);
    res.status(201).json({ ok: true, link, readiness, setup_mode: selfService ? 'portal_managed' : 'agent_credential', note: 'Dream ownership is claimed by HyperMove when the first episode is submitted or the first run starts.' });
  } catch (error) { respondMcpError(res, error); }
});

app.get('/v1/agents/:agentId/dream', (req: Request, res: Response): void => {
  const link = dreamState.getLink(req.params.agentId); res.json({ ok: true, link: link || null, latest_run: dreamState.latestRun(req.params.agentId) || null });
});

app.post('/v1/agents/:agentId/dream/reconcile', async (req: Request, res: Response): Promise<void> => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  const run = dreamState.latestRun(req.params.agentId);
  if (run?.status === 'running') { res.json({ ok: true, run: await reconcileDreamRun(run), imported: false }); return; }
  try {
    const synced = await syncCompletedDreamRun(req.params.agentId);
    res.json({ ok: true, run: synced.run, imported: synced.imported });
  } catch (error) {
    if (run) {
      const message = error instanceof Error ? error.message : 'Unable to sync Dream status';
      res.json({ ok: true, run: dreamState.updateRun(run.id, { reconciliation: { last_checked_at: new Date().toISOString(), last_error: message } }), imported: false });
      return;
    }
    respondMcpError(res, error);
  }
});

app.post('/v1/agents/:agentId/dream/sync', async (req: Request, res: Response): Promise<void> => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  try {
    const synced = await syncCompletedDreamRun(req.params.agentId);
    res.json({ ok: true, run: synced.run, imported: synced.imported });
  } catch (error) { respondMcpError(res, error); }
});

app.post('/v1/agents/:agentId/dream/trigger', async (req: Request, res: Response): Promise<void> => {
  const parsed = DreamTriggerSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; }
  const link = dreamState.getLink(req.params.agentId); if (!link) { res.status(409).json({ ok: false, error: 'dream_not_linked' }); return; }
  const active = dreamState.latestRun(req.params.agentId); if (active?.status === 'running') { res.status(409).json({ ok: false, error: 'dream_run_active', run: active }); return; }
  const run = dreamState.createRun(req.params.agentId, link, parsed.data.preset, parsed.data.budget_usd);
  try {
    const token = mcpTokenFor(req.params.agentId);
    // Connected agents already publish traces to the Gateway. Convert those
    // into idempotent, minimally meaningful Dream episodes before a run.
    const telemetry = agentIngestionStore.getTelemetry(req.params.agentId, 100);
    if (telemetry.length) {
      await hyperMove.call('submit_episode_log', {
        agent_id: link.hypermove_agent_id,
        episodes: telemetry.map((item) => ({
          episode_id: item.id,
          agent_id: link.hypermove_agent_id,
          timestamp: item.received_at,
          task_type: 'openx_execution_trace',
          outcome: item.status === 'success' ? 'success' : 'failure',
          steps: [{ action: item.task_id, result: item.status === 'success' ? 'completed' : 'failed', ...(item.status === 'failed' ? { error: 'Agent execution failed' } : {}) }],
          tags: item.tools_used,
        })),
      }, token);
    }
    const startArgs = { agent_id: link.hypermove_agent_id, config: { budget_usd: parsed.data.budget_usd, preset: parsed.data.preset } };
    const result = await hyperMove.call('start_dream', startArgs, token);
    const finished = result?.status === 'completed' || result?.status === 'partial';
    persistDreamLessons(req.params.agentId, run.id, result);
    const updated = dreamState.updateRun(run.id, { status: finished ? 'completed' : 'running', ...(finished ? { completed_at: new Date().toISOString() } : {}), result, learning_brief: learningBriefFrom(result) });
    queueDreamAudit(updated);
    if (updated?.status === 'running') scheduleDreamReconciliation(updated.id);
    res.status(202).json({ ok: true, run: updated });
  } catch (error) {
    const data = error instanceof McpError ? error.data : undefined;
    if (error instanceof McpError && error.status === 402) {
      const quote = paymentQuoteFrom(data);
      const config = xrplTestnetSettlement.config();
      const quoteExpired = Boolean(quote?.expires_at && Date.parse(quote.expires_at) <= Date.now());
      if (!quote || quoteExpired || !xrplTestnetSettlement.isConfigured() || !nPaymentXrplWallet.isConfigured() || quote.currency !== config.currency || quote.destination !== config.destination || quote.issuer !== config.issuer) {
        res.status(402).json({ ok: false, status: 'payment_required', run: dreamState.updateRun(run.id, { status: 'payment_required', quote: data }), quote: data }); return;
      }
      try {
        const receipt = await nPaymentXrplWallet.payRlusd(quote.destination, quote.amount, quote.nonce);
        const verified = await xrplTestnetSettlement.verifyQuotePayment(receipt.transaction_hash, quote);
        if (!receipt.validated || !verified.verified || !dreamState.claimSettlement(quote.quote_id, receipt.transaction_hash)) {
          const reason = verified.reason || 'settlement_replay_or_unvalidated';
          res.status(409).json({ ok: false, error: reason, run: dreamState.updateRun(run.id, { status: 'failed', settlement: { status: 'failed', quote_id: quote.quote_id, transaction_hash: receipt.transaction_hash, amount: quote.amount, currency: 'RLUSD', destination: quote.destination, attempted_at: new Date().toISOString(), reason } }) }); return;
        }
        await hyperMove.call('payments.settle', { quoteId: quote.quote_id, proof: receipt.transaction_hash }, mcpTokenFor(req.params.agentId));
        const result = await hyperMove.call('start_dream', { agent_id: link.hypermove_agent_id, config: { budget_usd: parsed.data.budget_usd, preset: parsed.data.preset } }, mcpTokenFor(req.params.agentId), { 'x-payment': receipt.transaction_hash, 'x-payment-quote-id': quote.quote_id });
        const finished = result?.status === 'completed' || result?.status === 'partial';
        persistDreamLessons(req.params.agentId, run.id, result);
        const settlement = { status: 'settled' as const, quote_id: quote.quote_id, transaction_hash: receipt.transaction_hash, amount: quote.amount, currency: 'RLUSD' as const, destination: quote.destination, attempted_at: new Date().toISOString() };
        const updated = dreamState.updateRun(run.id, { status: finished ? 'completed' : 'running', ...(finished ? { completed_at: new Date().toISOString() } : {}), settlement, result, learning_brief: learningBriefFrom(result) });
        queueDreamAudit(updated);
        if (updated?.status === 'running') scheduleDreamReconciliation(updated.id);
        res.status(202).json({ ok: true, run: updated }); return;
      } catch (settlementError) {
        const reason = settlementError instanceof Error ? settlementError.message : 'settlement_failed';
        res.status(502).json({ ok: false, error: 'settlement_failed', message: reason, run: dreamState.updateRun(run.id, { status: 'failed', error: reason, settlement: { status: 'failed', quote_id: quote.quote_id, amount: quote.amount, currency: 'RLUSD', destination: quote.destination, attempted_at: new Date().toISOString(), reason } }) }); return;
      }
    }
    dreamState.updateRun(run.id, { status: 'failed', error: error instanceof Error ? error.message : 'Dream request failed' }); respondMcpError(res, error);
  }
});

app.get('/v1/agents/:agentId/dream/runs/:runId/stream', (req: Request, res: Response): void => {
  const write = () => {
    const run = dreamState.getRun(req.params.runId);
    if (!run || run.openx_agent_id !== req.params.agentId) { res.write(`event: error\ndata: ${JSON.stringify({ error: 'run_not_found' })}\n\n`); res.end(); return; }
    res.write(`event: run_status\ndata: ${JSON.stringify(run)}\n\n`);
    if (run.status !== 'running') res.end();
  };
  res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  write(); const timer = setInterval(write, 1500); req.on('close', () => clearInterval(timer));
});

app.post('/v1/agents/:agentId/dream/settle', async (req: Request, res: Response): Promise<void> => {
  // Settlement is intentionally only reachable through the trigger flow: it
  // verifies the quote, ledger transaction, nonce, and replay claim first.
  void req;
  res.status(410).json({ ok: false, error: 'direct_settlement_disabled', message: 'Trigger Dream to settle a verified n-payment receipt.' });
});

app.get('/v1/agents/:agentId/wake', async (req: Request, res: Response): Promise<void> => {
  const link = dreamState.getLink(req.params.agentId); if (!link) { res.status(409).json({ ok: false, error: 'dream_not_linked' }); return; }
  try {
    const upstream = await hyperMove.call('get_wake_context', { agent_id: link.hypermove_agent_id }, mcpTokenFor(req.params.agentId));
    const overlay = dreamState.listLessons(req.params.agentId).filter((lesson) => lesson.state === 'PROMOTED_CONSTRAINT').map((lesson) => ({ type: 'openx_constraint', content: lesson.content, lesson_id: lesson.id }));
    const cached = dreamState.cacheWakeContext(req.params.agentId, upstream);
    res.json({ ok: true, source: 'live', cached_at: cached.cached_at, upstream, openx_constraints: overlay, effective_constraints: [...(upstream.active_constraints || []), ...overlay] });
  } catch (error) {
    const cached = dreamState.getCachedWakeContext(req.params.agentId);
    const overlay = dreamState.listLessons(req.params.agentId).filter((lesson) => lesson.state === 'PROMOTED_CONSTRAINT').map((lesson) => ({ type: 'openx_constraint', content: lesson.content, lesson_id: lesson.id }));
    if (cached && cached.upstream && typeof cached.upstream === 'object') { const upstream = cached.upstream as { active_constraints?: unknown[] }; res.json({ ok: true, source: 'cache', cached_at: cached.cached_at, upstream: cached.upstream, openx_constraints: overlay, effective_constraints: [...(upstream.active_constraints || []), ...overlay], warning: 'Live wake context is unavailable; showing cached context.' }); return; }
    res.status(503).json({ ok: false, error: 'wake_context_unavailable', message: error instanceof Error ? error.message : 'Unable to retrieve wake context' });
  }
});

app.get('/v1/agents/:agentId/lessons', (req: Request, res: Response): void => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  res.json({ ok: true, lessons: dreamState.listLessons(req.params.agentId).map((lesson) => ({ ...lesson, zerog_provenance: lesson.state === 'PROMOTED_CONSTRAINT' ? agentKnowledgeArchive.lessonProvenance(req.params.agentId, lesson.id) : undefined })) });
});
app.get('/v1/agents/:agentId/lessons/:lessonId/0g-proof', async (req: Request, res: Response): Promise<void> => {
  if (!agentRegistry.get(req.params.agentId)) { res.status(404).json({ ok: false, error: 'agent_not_found' }); return; }
  if (!dreamState.listLessons(req.params.agentId).some((lesson) => lesson.id === req.params.lessonId)) { res.status(404).json({ ok: false, error: 'lesson_not_found' }); return; }
  const proof = await agentKnowledgeArchive.lessonProof(req.params.agentId, req.params.lessonId);
  if (!proof.verified) { res.status(409).json({ ok: false, error: 'proof_not_available', provenance: proof.provenance }); return; }
  res.json({ ok: true, proof: { verified: true, provenance: proof.provenance, canonical_payload: proof.canonical_payload } });
});
app.post('/v1/agents/:agentId/lessons', (req: Request, res: Response): void => { const parsed = LessonSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; } const lesson = dreamState.addLesson(req.params.agentId, parsed.data.content, parsed.data.source); enqueueKnowledge(req.params.agentId, { source_type: 'lesson', source_id: lesson.id, payload: lesson }); res.status(201).json({ ok: true, lesson }); });
app.post('/v1/agents/:agentId/lessons/:lessonId/resolve', (req: Request, res: Response): void => { const parsed = LessonResolutionSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload' }); return; } const lesson = dreamState.resolveLesson(req.params.agentId, req.params.lessonId, parsed.data.action); if (!lesson) { res.status(404).json({ ok: false, error: 'lesson_not_found' }); return; } enqueueKnowledge(req.params.agentId, { source_type: 'lesson', source_id: lesson.id, payload: lesson }); if (lesson.state === 'PROMOTED_CONSTRAINT') enqueueKnowledge(req.params.agentId, remArchiveInput(lesson)); res.json({ ok: true, lesson }); });

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
        message: 'fields must be a comma-separated subset of: info,status,model,memory',
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
  enqueueKnowledge(stored.agent_id, { source_type: 'telemetry', source_id: stored.id, payload: stored });
  if (parseResult.data.task_state === 'completed' || parseResult.data.task_state === 'failed') auditorService.audit(stored.agent_id, 'terminal_task');
  res.status(201).json({
    ok: true,
    event_type: 'telemetry',
    id: stored.id,
    agent_id: stored.agent_id,
    ingested_at: stored.received_at,
  });
});

/**
 * Detailed, metadata-only usage ledger. Billing calculations deliberately use
 * this endpoint instead of legacy aggregate telemetry so token dimensions and
 * tool units are auditable.
 */
app.post('/v1/agent/usage-events', (req: Request, res: Response): void => {
  const parsed = UsageEventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: 'invalid_payload', message: parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join(', ') }); return; }
  const agentKey = req.headers['x-agent-key'];
  if (!agentRegistry.authorizeTelemetry(parsed.data.agent_id, typeof agentKey === 'string' ? agentKey : undefined)) { res.status(401).json({ ok: false, error: 'invalid_agent_key', message: 'A valid agent key is required' }); return; }
  try {
    agentRegistry.recordHeartbeat(parsed.data.agent_id, { capabilities: [...parsed.data.tool_calls.map((call) => call.tool_id), ...parsed.data.skill_invocations.map((skill) => skill.skill_id)] });
    const result = usageLedger.record(parsed.data);
    if (result.created) enqueueKnowledge(result.event.agent_id, { source_type: 'usage_summary', source_id: result.event.event_id, payload: result.event });
    res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, event_id: result.event.event_id, agent_id: result.event.agent_id, received_at: result.event.received_at });
  } catch (error) {
    if (error instanceof AgentRegistryError) { res.status(error.status).json({ ok: false, error: error.code }); return; }
    res.status(503).json({ ok: false, error: 'usage_ledger_unavailable', message: error instanceof Error ? error.message : 'Usage ledger unavailable' });
  }
});

app.get('/v1/agents/:agentId/usage-summary', (req: Request, res: Response): void => {
  if (!canReadUsageSummary(req, req.params.agentId)) { res.status(401).json({ ok: false, error: 'invalid_agent_key', message: 'A valid agent key is required to read usage' }); return; }
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : undefined;
  try { res.json({ ok: true, summary: usageLedger.summary(req.params.agentId, month) }); }
  catch (error) { res.status(503).json({ ok: false, error: 'usage_ledger_unavailable', message: error instanceof Error ? error.message : 'Usage ledger unavailable' }); }
});

app.get('/v1/agents/:agentId/usage-detail', (req: Request, res: Response): void => {
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : undefined;
  try { res.json({ ok: true, detail: usageLedger.detail(req.params.agentId, month) }); }
  catch (error) { res.status(503).json({ ok: false, error: 'usage_ledger_unavailable', message: error instanceof Error ? error.message : 'Usage ledger unavailable' }); }
});

app.get('/v1/usage-summary', (req: Request, res: Response): void => {
  if (!canReadUsageSummary(req)) { res.status(401).json({ ok: false, error: 'usage_read_auth_required', message: 'A valid usage read token is required' }); return; }
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : undefined;
  try { res.json({ ok: true, summaries: usageLedger.portfolio(month) }); }
  catch (error) { res.status(503).json({ ok: false, error: 'usage_ledger_unavailable', message: error instanceof Error ? error.message : 'Usage ledger unavailable' }); }
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
  enqueueKnowledge(stored.agent_id, { source_type: 'memory_episode', source_id: stored.id, payload: stored });
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
  enqueueKnowledge(stored.agent_id, { source_type: 'skill_metadata', source_id: stored.id, payload: stored });
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

if (shouldRunGateway && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    console.log(`[openx-gateway] Core backend sidecar listening on http://${HOST}:${PORT}`);
  });
}
