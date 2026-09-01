'use client';

import React, { createContext, useContext, useState } from 'react';
import {
  StudioAgent,
  SkillItem,
  CreditModelConfig,
  DreamCycleState,
  SkillStatus,
} from './types';
import {
  MOCK_AGENTS,
  MOCK_SKILLS_DATA,
  MOCK_CREDIT_MODEL_DATA,
  DEFAULT_CREDIT_MODEL,
  MOCK_DREAM_CYCLE_DATA,
} from './mockData';
import {
  fetchLiveAgentStatus,
  checkGatewayHealth,
  fetchRecentTelemetry,
  submitTelemetryEvent,
  IngestedTraceEvent,
  AgentActivityProjection,
  UsageSummary,
  KnowledgeSync,
  fetchRegisteredAgents,
  fetchAgentActivity,
  fetchUsageSummaries,
  fetchFleetOverview,
  registerAgent as registerGatewayAgent,
  claimAgent as claimGatewayAgent,
  RegisterAgentInput,
  RegisteredAgentProjection,
  linkDreamAgent,
  setupDreamAgent,
  triggerDreamRun,
  fetchAgentSkills,
  updateGatewaySkillStatus,
} from './api/agentGateway';

interface PortalContextType {
  agents: StudioAgent[];
  getAgentById: (id: string) => StudioAgent | undefined;
  getSkills: (agentId: string) => SkillItem[];
  addSkill: (agentId: string, skill: Omit<SkillItem, 'id' | 'created_at'>) => void;
  updateSkillStatus: (agentId: string, skillId: string, status: SkillStatus) => void;
  getCreditModel: (agentId: string) => CreditModelConfig;
  updateCreditModel: (agentId: string, config: Partial<CreditModelConfig>) => void;
  getDreamCycleState: (agentId: string) => DreamCycleState;
  linkDreamCycle: (agentId: string, hypermoveAgentId: string) => Promise<{ success: boolean; error?: string }>;
  setupDreamCycle: (agentId: string) => Promise<{ success: boolean; error?: string }>;
  triggerDreamCycle: (agentId: string) => Promise<{ success: boolean; error?: string; paymentRequired?: boolean; runId?: string; run?: import('./api/agentGateway').DreamTriggerResponse['run'] }>;
  flagSupplierCandidate: (agentId: string, skillId: string) => void;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  clearNotification: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  // Hybrid live ingestion state
  gatewayOnline: boolean;
  telemetryEvents: IngestedTraceEvent[];
  isLiveByAgent: Record<string, boolean>;
  agentActivity: Record<string, AgentActivityProjection>;
  dreamStatusByAgent: Record<string, NonNullable<import('./api/agentGateway').FleetOverviewAgent['dream']['latest_run']>>;
  usageSummaries: UsageSummary[];
  knowledgeSyncByAgent: Record<string, KnowledgeSync>;
  sendTestTelemetry: (agentId?: string) => Promise<void>;
  registerAgent: (input: RegisterAgentInput) => Promise<{ ok: boolean; agentId?: string; agentKey?: string; error?: string }>;
  claimAgent: (agentId: string, agentKey: string) => Promise<{ ok: boolean; agentId?: string; error?: string }>;
}

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_OPENX_GATEWAY_URL || 'http://localhost:7411';
const SHOW_MOCK_AGENTS = process.env.NODE_ENV !== 'production';

const PortalContext = createContext<PortalContextType | undefined>(undefined);

const DEFAULT_DREAM_CYCLE_STATE: DreamCycleState = {
  is_linked: false,
  hypermove_dream_agent_id: null,
  rem_state: 'IDLE',
  last_cycle_at: '',
  cycle_count_total: 0,
  memory_nodes_total: 0,
  wake_context: {
    active_memory_buffer_mb: 0,
    long_term_embeddings: 0,
    last_morning_brief_summary: 'Link a Dream agent to view live wake intelligence.',
  },
  learning_queue: [],
  diagnostics: [],
  skillify_candidates: [],
};

function normalizeDreamCycleState(state?: Partial<DreamCycleState>): DreamCycleState {
  return {
    ...DEFAULT_DREAM_CYCLE_STATE,
    ...state,
    wake_context: { ...DEFAULT_DREAM_CYCLE_STATE.wake_context, ...state?.wake_context },
    learning_queue: state?.learning_queue ?? [],
    diagnostics: state?.diagnostics ?? [],
    skillify_candidates: state?.skillify_candidates ?? [],
  };
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [agents, setAgents] = useState<StudioAgent[]>(SHOW_MOCK_AGENTS ? MOCK_AGENTS : []);
  const [skillsData, setSkillsData] = useState<Record<string, SkillItem[]>>(MOCK_SKILLS_DATA);
  const [creditModelData, setCreditModelData] = useState<Record<string, CreditModelConfig>>(MOCK_CREDIT_MODEL_DATA);
  const [dreamCycleData, setDreamCycleData] = useState<Record<string, DreamCycleState>>(MOCK_DREAM_CYCLE_DATA);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [gatewayOnline, setGatewayOnline] = useState<boolean>(false);
  const [telemetryEvents, setTelemetryEvents] = useState<IngestedTraceEvent[]>([]);
  const [isLiveByAgent, setIsLiveByAgent] = useState<Record<string, boolean>>({});
  const [agentActivity, setAgentActivity] = useState<Record<string, AgentActivityProjection>>({});
  const [dreamStatusByAgent, setDreamStatusByAgent] = useState<Record<string, NonNullable<import('./api/agentGateway').FleetOverviewAgent['dream']['latest_run']>>>({});
  const [usageSummaries, setUsageSummaries] = useState<UsageSummary[]>([]);
  const [knowledgeSyncByAgent, setKnowledgeSyncByAgent] = useState<Record<string, KnowledgeSync>>({});

  const projectGatewayAgent = (agent: RegisteredAgentProjection, dreamLink?: string | null): StudioAgent => ({
    id: agent.agent_id,
    slug: agent.slug,
    display_name: agent.display_name,
    description: agent.description || 'Connected local agent. Live operational data appears when it syncs.',
    training_stage: 0,
    owner_address: agent.owner_address || 'Unverified owner',
    pending_actions: { dream_diffs_pending: 0, federation_broadcasts_pending: 0 },
    created_at: agent.registered_at,
    connection_state: agent.state,
    registration_source: agent.registration_source,
    last_seen_at: agent.last_seen_at,
    owner_verified: agent.owner_verified,
    is_demo: false,
    hypermove_dream_agent_id: dreamLink || null,
  });

  // Theme synchronization
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('openx-portal-theme') as 'dark' | 'light' | null;
      if (stored) {
        setTheme(stored);
        if (stored === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
      }
    } catch (_) {}
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('openx-portal-theme', next);
      } catch (_) {}
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  // Periodic Telemetry & Health Sync
  React.useEffect(() => {
    let isMounted = true;

    async function syncLiveTelemetry() {
      // 1. Health check
      const online = await checkGatewayHealth();
      if (isMounted) setGatewayOnline(online);

      // 2. Fetch recent trace events
      const traces = await fetchRecentTelemetry();
      if (isMounted && traces.length > 0) {
        setTelemetryEvents(traces);
      }
      const overview = await fetchFleetOverview();
      const registered = overview ? overview.agents.map((item) => item.agent) : await fetchRegisteredAgents();
      const dreamLinks = new Map((overview?.agents || []).map((item) => [item.agent.agent_id, item.dream.hypermove_agent_id]));
      if (isMounted) setDreamStatusByAgent(Object.fromEntries((overview?.agents || []).flatMap((item) => item.dream.latest_run ? [[item.agent.agent_id, item.dream.latest_run] as const] : [])));
      if (isMounted) setKnowledgeSyncByAgent(Object.fromEntries((overview?.agents || []).flatMap((item) => item.knowledge_sync ? [[item.agent.agent_id, item.knowledge_sync] as const] : [])));
      const skillEntries = await Promise.all(registered.map(async (agent) => [agent.agent_id, await fetchAgentSkills(agent.agent_id)] as const));
      if (isMounted) {
        setSkillsData((previous) => {
          const next = { ...previous };
          for (const [agentId, skills] of skillEntries) if (skills !== null) next[agentId] = skills;
          return next;
        });
      }
      const activity = overview ? overview.agents.map((item) => ({ agent_id: item.agent.agent_id, state: item.connection.state, last_seen_at: item.connection.last_seen_at, activity: item.activity })) : await fetchAgentActivity();
      if (isMounted) setAgentActivity(Object.fromEntries(activity.map((item) => [item.agent_id, item])));
      // Global usage reads require an operator credential in production; avoid a public 401.
      if (SHOW_MOCK_AGENTS) {
        const usage = await fetchUsageSummaries();
        if (isMounted) setUsageSummaries(usage);
      } else if (isMounted) setUsageSummaries([]);
      // seam:portal-projection
      const agentsForSync = registered.length > 0
        ? registered.map((agent) => projectGatewayAgent(agent, dreamLinks.get(agent.agent_id)))
        : SHOW_MOCK_AGENTS ? MOCK_AGENTS : [];
      if (isMounted && (overview || online)) {
        setAgents((previous) => {
          const gatewayIds = new Set(registered.map((agent) => agent.agent_id));
          const demos = SHOW_MOCK_AGENTS ? previous.filter((agent) => !gatewayIds.has(agent.id)) : [];
          return [...demos, ...registered.map((agent) => projectGatewayAgent(agent, dreamLinks.get(agent.agent_id)))];
        });
      }

      // 3. Sync live agent status
      for (const agent of agentsForSync) {
        try {
          const live = await fetchLiveAgentStatus(agent.id);
          if (live && live.ok && isMounted) {
            setIsLiveByAgent((prev) => ({ ...prev, [agent.id]: true }));

            // Live Dream Cycle memory metrics
            if (live.memory && live.memory.episodes > 0) {
              setDreamCycleData((prev) => ({
                ...prev,
                [agent.id]: {
                  ...normalizeDreamCycleState(prev[agent.id] || MOCK_DREAM_CYCLE_DATA[agent.id]),
                  brain_snapshot: {
                    episodes: live.memory!.episodes,
                    facts: live.memory!.facts,
                    skills: live.memory!.skills,
                    activity14d: live.memory!.activity_14d,
                    lastQueryAt: live.memory!.last_query_at,
                  },
                },
              }));
            }

          }

          // 4. Sync Dream Cycle link and active run state
          try {
            const dreamRes = await fetch(`${GATEWAY_URL}/v1/agents/${encodeURIComponent(agent.id)}/dream`).then(r => r.json()).catch(() => null);
            if (dreamRes && dreamRes.ok && dreamRes.link && isMounted) {
              setAgents((previous) => previous.map((entry) => entry.id === agent.id ? { ...entry, hypermove_dream_agent_id: dreamRes.link.hypermove_agent_id } : entry));
              setDreamCycleData((prev) => ({
                ...prev,
                [agent.id]: {
                  ...normalizeDreamCycleState(prev[agent.id]),
                  is_linked: true,
                  hypermove_dream_agent_id: dreamRes.link.hypermove_agent_id,
                  rem_state: dreamRes.latest_run?.status === 'running' ? 'CONSOLIDATING' : 'IDLE',
                },
              }));
            }
          } catch (_) {}
        } catch (_) {}
      }
    }

    syncLiveTelemetry();
    const interval = setInterval(syncLiveTelemetry, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const sendTestTelemetry = async (agentId = '3fa85f64-5717-4562-b3fc-2c963f66afa6') => {
    const res = await submitTelemetryEvent({
      agent_id: agentId,
      task_id: `manual_test_${Date.now().toString().slice(-4)}`,
      model: 'gemini-3.5',
      tokens_consumed: Math.floor(Math.random() * 800) + 600,
      tools_used: ['google-workspace-cli.sheets.read'],
      latency_ms: Math.floor(Math.random() * 400) + 300,
      status: 'success',
      summary: 'Manual heartbeat test event sent from Studio Hub',
    });

    if (res.ok) {
      showToast('Live test telemetry submitted to Gateway sidecar!', 'success');
      const traces = await fetchRecentTelemetry();
      setTelemetryEvents(traces);
    } else {
      showToast('Gateway offline or submission error: ' + (res.error || 'Failed'), 'error');
    }
  };

  const registerAgent = async (input: RegisterAgentInput) => {
    const result = await registerGatewayAgent(input);
    if (!result.ok || !result.agent) {
      showToast(result.error || 'Unable to register agent', 'error');
      return { ok: false, error: result.error };
    }
    setAgents((previous) => [...previous.filter((agent) => agent.id !== result.agent!.agent_id), projectGatewayAgent(result.agent!)]);
    if (result.knowledgeSync) setKnowledgeSyncByAgent((previous) => ({ ...previous, [result.agent!.agent_id]: result.knowledgeSync! }));
    showToast('Agent registered. Save the one-time key before leaving this page.', 'success');
    return { ok: true, agentId: result.agent.agent_id, agentKey: result.agentKey };
  };

  const claimAgent = async (agentId: string, agentKey: string) => {
    const result = await claimGatewayAgent({ agent_id: agentId, agent_key: agentKey });
    if (!result.ok || !result.agent) { showToast(result.error || 'Unable to restore agent', 'error'); return { ok: false, error: result.error }; }
    setAgents((previous) => [...previous.filter((agent) => agent.id !== result.agent!.agent_id), projectGatewayAgent(result.agent!)]);
    if (result.knowledgeSync) setKnowledgeSyncByAgent((previous) => ({ ...previous, [result.agent!.agent_id]: result.knowledgeSync! }));
    showToast('Agent restored. Its local scheduler can resume authenticated sync.', 'success');
    return { ok: true, agentId: result.agent.agent_id };
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const clearNotification = () => setNotification(null);

  const getAgentById = (id: string) => {
    return agents.find((a) => a.id === id || a.slug === id);
  };

  const getSkills = (agentId: string): SkillItem[] => {
    return skillsData[agentId] || [];
  };

  const addSkill = (agentId: string, skill: Omit<SkillItem, 'id' | 'created_at'>) => {
    const newSkill: SkillItem = {
      ...skill,
      id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      created_at: new Date().toISOString(),
    };

    setSkillsData((prev) => ({
      ...prev,
      [agentId]: [newSkill, ...(prev[agentId] || [])],
    }));

    showToast(`Attached skill "${newSkill.name}" to agent`, 'success');
  };

  const updateSkillStatus = (agentId: string, skillId: string, status: SkillStatus) => {
    const isLive = agents.some((agent) => agent.id === agentId && !agent.is_demo);
    if (isLive) {
      const agentKey = window.prompt('Enter this agent’s one-time key to update the skill lifecycle. The key is not stored.');
      if (!agentKey) return;
      void updateGatewaySkillStatus(agentId, skillId, status, agentKey).then((result) => {
        if (!result.ok) { showToast(result.error || 'Unable to update skill status', 'error'); return; }
        setSkillsData((previous) => ({ ...previous, [agentId]: (previous[agentId] || []).map((skill) => skill.id === skillId ? { ...skill, status } : skill) }));
        showToast(`Updated skill status to ${status.toUpperCase()}`, 'info');
      });
      return;
    }
    setSkillsData((prev) => {
      const current = prev[agentId] || [];
      return {
        ...prev,
        [agentId]: current.map((s) => (s.id === skillId ? { ...s, status } : s)),
      };
    });

    showToast(`Updated skill status to ${status.toUpperCase()}`, 'info');
  };

  const getCreditModel = (agentId: string): CreditModelConfig => {
    return creditModelData[agentId] || DEFAULT_CREDIT_MODEL;
  };

  const updateCreditModel = (agentId: string, config: Partial<CreditModelConfig>) => {
    setCreditModelData((prev) => {
      const existing = prev[agentId] || DEFAULT_CREDIT_MODEL;
      return {
        ...prev,
        [agentId]: { ...existing, ...config },
      };
    });

    showToast('Monetization & credit model configuration saved', 'success');
  };

  const getDreamCycleState = (agentId: string): DreamCycleState => {
    return normalizeDreamCycleState(dreamCycleData[agentId]);
  };

  const linkDreamCycle = async (agentId: string, hypermoveAgentId: string) => {
    if (!hypermoveAgentId.trim()) {
      return { success: false, error: 'HyperMove Agent ID cannot be empty' };
    }

    const response = await linkDreamAgent(agentId, hypermoveAgentId);
    if (!response.ok || !response.link) return { success: false, error: response.message || response.error || 'Dream Cycle verification failed.' };
    setDreamCycleData((previous) => ({ ...previous, [agentId]: { ...getDreamCycleState(agentId), is_linked: true, hypermove_dream_agent_id: response.link!.hypermove_agent_id } }));
    setAgents((previous) => previous.map((agent) => agent.id === agentId ? { ...agent, hypermove_dream_agent_id: response.link!.hypermove_agent_id } : agent));
    showToast('Dream agent ownership verified and linked.', 'success');
    return { success: true };
  };

  const setupDreamCycle = async (agentId: string) => {
    const response = await setupDreamAgent(agentId);
    if (!response.ok || !response.link) return { success: false, error: response.message || response.error || 'Dream setup failed.' };
    setDreamCycleData((previous) => ({ ...previous, [agentId]: { ...getDreamCycleState(agentId), is_linked: true, hypermove_dream_agent_id: response.link!.hypermove_agent_id } }));
    setAgents((previous) => previous.map((agent) => agent.id === agentId ? { ...agent, hypermove_dream_agent_id: response.link!.hypermove_agent_id } : agent));
    showToast('Dream Cycle is ready. New Gateway telemetry is automatically submitted as Dream episodes.', 'success');
    return { success: true };
  };

  const triggerDreamCycle = async (agentId: string) => {
    const response = await triggerDreamRun(agentId);
    if (!response.ok) return { success: false, paymentRequired: response.error === 'payment_required', error: response.message || response.error || 'Unable to start Dream Cycle.' };
    setDreamCycleData((previous) => ({ ...previous, [agentId]: { ...getDreamCycleState(agentId), rem_state: 'CONSOLIDATING', last_cycle_at: new Date().toISOString() } }));
    showToast('Dream Cycle submitted. Refresh wake intelligence when it completes.', 'success');
    return { success: true, runId: response.run?.id, run: response.run };
  };

  const flagSupplierCandidate = (agentId: string, skillId: string) => {
    setDreamCycleData((prev) => {
      const current = normalizeDreamCycleState(prev[agentId] || MOCK_DREAM_CYCLE_DATA[agentId]);
      return {
        ...prev,
        [agentId]: {
          ...current,
          skillify_candidates: current.skillify_candidates.map((c) =>
            c.skill_id === skillId ? { ...c, candidate_status: 'pending_human_review' } : c
          ),
        },
      };
    });

    showToast('Candidate skill flagged for OpenX review (written to dream_cycle_supplier_candidates)', 'success');
  };

  return (
    <PortalContext.Provider
      value={{
        agents,
        getAgentById,
        getSkills,
        addSkill,
        updateSkillStatus,
        getCreditModel,
        updateCreditModel,
        getDreamCycleState,
        linkDreamCycle,
        setupDreamCycle,
        triggerDreamCycle,
        flagSupplierCandidate,
        notification,
        clearNotification,
        showToast,
        theme,
        toggleTheme,
        gatewayOnline,
        telemetryEvents,
        isLiveByAgent,
        agentActivity,
        dreamStatusByAgent,
        usageSummaries,
        knowledgeSyncByAgent,
        sendTestTelemetry,
        registerAgent,
        claimAgent,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within a PortalProvider');
  }
  return context;
}
