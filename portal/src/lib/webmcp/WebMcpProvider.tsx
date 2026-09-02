'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  webMcpAgentOverview, webMcpAskAuditor, webMcpAuditor, webMcpConnectAgent,
  webMcpDream, webMcpFleet, webMcpSetSkillStatus, webMcpSkills,
  webMcpTriggerDream, webMcpWallet, WebMcpSection,
} from '@/lib/api/agentGateway';
import { PORTAL_LIVE_REFRESH_EVENT } from '@/lib/portalContext';

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: { readOnlyHint: boolean }; execute: (input: Record<string, unknown>) => Promise<unknown> };
type ModelContext = { registerTool: (tool: Tool) => void | Promise<void> };
type ModelDocument = Document & { modelContext?: ModelContext };

const noInput = { type: 'object', additionalProperties: false, properties: {} };
const sectionPath = (agentId: string, section: WebMcpSection) => section === 'studio' ? '/' : `/${encodeURIComponent(agentId)}/${section}`;
const requestId = () => `webmcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const agentIdSchema = { type: 'string', minLength: 1, maxLength: 120, description: 'OpenX agent identifier.' };
const writeToolNames = new Set(['openx_register_agent', 'openx_navigate_portal_section', 'openx_set_skill_status', 'openx_trigger_dream_cycle', 'openx_ask_auditor']);
const withAgentId = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object', additionalProperties: false, required: ['agent_id', ...required], properties: { agent_id: agentIdSchema, ...properties },
});

/** Registers global browser-local OpenX tools only when ChatGPT exposes WebMCP. */
export function WebMcpProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const registered = React.useRef(new Set<string>());
  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    const context = (document as ModelDocument).modelContext;
    setAvailable(Boolean(context));
    document.documentElement.dataset.webmcp = context ? 'ready' : 'unavailable';
    if (!context) return;
    const register = (tool: Tool) => {
      if (registered.current.has(tool.name)) return;
      registered.current.add(tool.name);
      const registeredTool = { ...tool, annotations: { readOnlyHint: !writeToolNames.has(tool.name) } };
      void Promise.resolve(context.registerTool(registeredTool)).catch(() => registered.current.delete(tool.name));
    };
    const refreshAfterWrite = async <Result extends { ok?: boolean }>(action: () => Promise<Result>) => {
      const result = await action();
      if (result.ok) window.dispatchEvent(new Event(PORTAL_LIVE_REFRESH_EVENT));
      return result;
    };
    register({ name: 'openx_list_public_agents', description: 'Read public OpenX Portal agent summaries and current connection state.', inputSchema: noInput, execute: async () => webMcpFleet() });
    register({ name: 'openx_register_agent', description: 'Create or restore a public OpenX agent registration. A new registration returns its one-time agent key in this chat transcript.', inputSchema: { type: 'object', additionalProperties: false, required: ['display_name', 'host_type'], properties: { display_name: { type: 'string', minLength: 1, maxLength: 120 }, host_type: { type: 'string', enum: ['kiro-cli', 'claude-code', 'adk-python', 'custom'] }, description: { type: 'string', maxLength: 500 }, model: { type: 'string', maxLength: 120 }, capabilities: { type: 'array', items: { type: 'string' }, maxItems: 32 } } }, execute: async (input) => refreshAfterWrite(() => webMcpConnectAgent(input as unknown as Parameters<typeof webMcpConnectAgent>[0])) });
    register({ name: 'openx_get_agent_overview', description: 'Read an OpenX agent’s public profile, live task activity, Dream state, and knowledge-sync state.', inputSchema: withAgentId({}), execute: async (input) => webMcpAgentOverview(String(input.agent_id)) });
    register({ name: 'openx_get_working_process', description: 'Read the current or latest task process for an OpenX agent.', inputSchema: withAgentId({}), execute: async (input) => webMcpAgentOverview(String(input.agent_id)).then((result) => ({ ok: result.ok, activity: result.activity })) });
    register({ name: 'openx_list_agent_skills', description: 'Read an OpenX agent’s reported capabilities and candidate skills.', inputSchema: withAgentId({}), execute: async (input) => webMcpSkills(String(input.agent_id)) });
    register({ name: 'openx_get_wallet_summary', description: 'Read the public Status Network wallet balance summary for an OpenX agent.', inputSchema: withAgentId({}), execute: async (input) => webMcpWallet(String(input.agent_id)) });
    register({ name: 'openx_get_dream_status', description: 'Read an OpenX agent’s Dream Cycle link and latest run summary.', inputSchema: withAgentId({}), execute: async (input) => webMcpDream(String(input.agent_id)) });
    register({ name: 'openx_get_auditor_summary', description: 'Read evidence-only auditor status and reviewed-lesson summary for an OpenX agent.', inputSchema: withAgentId({}), execute: async (input) => webMcpAuditor(String(input.agent_id)) });
    register({ name: 'openx_navigate_portal_section', description: 'Open an OpenX agent section in the visible Portal. This changes the current page only.', inputSchema: withAgentId({ section: { type: 'string', enum: ['studio', 'skills', 'credit-model', 'dream-cycle', 'auditor'] } }, ['section']), execute: async (input) => { const agentId = String(input.agent_id); const section = input.section as WebMcpSection; const href = sectionPath(agentId, section); router.push(href); return { ok: true, section, href }; } });
    register({ name: 'openx_set_skill_status', description: 'Change an OpenX skill lifecycle status. This writes the selected status to the public Gateway.', inputSchema: withAgentId({ skill_id: { type: 'string', minLength: 1 }, status: { type: 'string', enum: ['active', 'in_audit', 'deprecated'] } }, ['skill_id', 'status']), execute: async (input) => refreshAfterWrite(() => webMcpSetSkillStatus(String(input.agent_id), String(input.skill_id), input.status as 'active' | 'in_audit' | 'deprecated')) });
    register({ name: 'openx_trigger_dream_cycle', description: 'Start a Dream Cycle for an OpenX agent. This may create a paid run and changes its run state.', inputSchema: withAgentId({ preset: { type: 'string', enum: ['frugal', 'balanced', 'thorough'] } }), execute: async (input) => refreshAfterWrite(() => webMcpTriggerDream(String(input.agent_id), input.preset as 'frugal' | 'balanced' | 'thorough' | undefined)) });
    register({ name: 'openx_ask_auditor', description: 'Send a question to an OpenX agent’s evidence-bound auditor. This records a new auditor chat turn.', inputSchema: withAgentId({ message: { type: 'string', minLength: 1, maxLength: 1200 } }, ['message']), execute: async (input) => refreshAfterWrite(() => webMcpAskAuditor(String(input.agent_id), String(input.message), requestId())) });
  }, [router]);

  return <>{children}{available && <span className="sr-only" aria-live="polite">WebMCP tools ready</span>}</>;
}
