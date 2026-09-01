'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  webMcpAgentOverview, webMcpAskAuditor, webMcpAuditor, webMcpConnectAgent,
  webMcpDream, webMcpFleet, webMcpSetSkillStatus, webMcpSkills,
  webMcpTriggerDream, webMcpWallet, WebMcpSection,
} from '@/lib/api/agentGateway';

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; execute: (input: Record<string, unknown>) => Promise<unknown> };
type ModelContext = { registerTool: (tool: Tool) => void };
type ModelDocument = Document & { modelContext?: ModelContext };

const noInput = { type: 'object', additionalProperties: false, properties: {} };
const sectionPath = (agentId: string, section: WebMcpSection) => section === 'studio' ? '/' : `/${encodeURIComponent(agentId)}/${section}`;
const uuidFromPath = (pathname: string): string | undefined => {
  const candidate = pathname.split('/').filter(Boolean)[0];
  return candidate && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(candidate) ? candidate : undefined;
};
const requestId = () => `webmcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Registers browser-local tools only when ChatGPT exposes the imperative WebMCP API. */
export function WebMcpProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const agentId = uuidFromPath(pathname);
  const registered = React.useRef(new Set<string>());
  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    const context = (document as ModelDocument).modelContext;
    setAvailable(Boolean(context));
    document.documentElement.dataset.webmcp = context ? 'ready' : 'unavailable';
    if (!context) return;
    const register = (tool: Tool) => {
      if (registered.current.has(tool.name)) return;
      context.registerTool(tool);
      registered.current.add(tool.name);
    };
    register({ name: 'list_public_agents', description: 'List public OpenX Portal agent summaries and their current connection state.', inputSchema: noInput, execute: async () => webMcpFleet() });
    register({ name: 'connect_agent', description: 'Create or restore an OpenX agent registration. This public action returns a one-time agent key in the chat transcript when a new identity is created.', inputSchema: { type: 'object', additionalProperties: false, required: ['display_name', 'host_type'], properties: { display_name: { type: 'string', minLength: 1, maxLength: 120 }, host_type: { type: 'string', enum: ['kiro-cli', 'claude-code', 'adk-python', 'custom'] }, description: { type: 'string', maxLength: 500 }, model: { type: 'string', maxLength: 120 }, capabilities: { type: 'array', items: { type: 'string' }, maxItems: 32 } } }, execute: async (input) => webMcpConnectAgent(input as unknown as Parameters<typeof webMcpConnectAgent>[0]) });
    if (!agentId) return;
    register({ name: 'get_agent_overview', description: 'Get this connected agent’s public profile, live task activity, Dream state, and knowledge-sync state.', inputSchema: noInput, execute: async () => webMcpAgentOverview(agentId) });
    register({ name: 'track_working_process', description: 'Get the current or latest task process for this agent.', inputSchema: noInput, execute: async () => webMcpAgentOverview(agentId).then((result) => ({ ok: result.ok, activity: result.activity })) });
    register({ name: 'list_agent_skills', description: 'List this agent’s reported capabilities and candidate skills.', inputSchema: noInput, execute: async () => webMcpSkills(agentId) });
    register({ name: 'get_wallet_summary', description: 'Get the public Status Network wallet balance summary for this agent.', inputSchema: noInput, execute: async () => webMcpWallet(agentId) });
    register({ name: 'get_dream_status', description: 'Get this agent’s Dream Cycle link and latest run summary.', inputSchema: noInput, execute: async () => webMcpDream(agentId) });
    register({ name: 'get_auditor_summary', description: 'Get evidence-only auditor status and reviewed-lesson summary for this agent.', inputSchema: noInput, execute: async () => webMcpAuditor(agentId) });
    register({ name: 'navigate_portal_section', description: 'Open a section of this agent in the visible OpenX Portal.', inputSchema: { type: 'object', additionalProperties: false, required: ['section'], properties: { section: { type: 'string', enum: ['studio', 'skills', 'credit-model', 'dream-cycle', 'auditor'] } } }, execute: async (input) => { const section = input.section as WebMcpSection; router.push(sectionPath(agentId, section)); return { ok: true, section, href: sectionPath(agentId, section) }; } });
    register({ name: 'set_skill_status', description: 'Publicly change the lifecycle status of a skill on this agent.', inputSchema: { type: 'object', additionalProperties: false, required: ['skill_id', 'status'], properties: { skill_id: { type: 'string', minLength: 1 }, status: { type: 'string', enum: ['active', 'in_audit', 'deprecated'] } } }, execute: async (input) => webMcpSetSkillStatus(agentId, String(input.skill_id), input.status as 'active' | 'in_audit' | 'deprecated') });
    register({ name: 'trigger_dream_cycle', description: 'Publicly start a Dream Cycle for this linked agent.', inputSchema: { type: 'object', additionalProperties: false, properties: { preset: { type: 'string', enum: ['frugal', 'balanced', 'thorough'] } } }, execute: async (input) => webMcpTriggerDream(agentId, input.preset as 'frugal' | 'balanced' | 'thorough' | undefined) });
    register({ name: 'ask_auditor', description: 'Ask the evidence-bound auditor about this connected agent.', inputSchema: { type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string', minLength: 1, maxLength: 1200 } } }, execute: async (input) => webMcpAskAuditor(agentId, String(input.message), requestId()) });
  }, [agentId, router]);

  return <>{children}{available && <span className="sr-only" aria-live="polite">WebMCP tools ready</span>}</>;
}
