'use client';

import React, { createContext, useContext, useState } from 'react';
import {
  StudioAgent,
  AgentWalletData,
  SkillItem,
  CreditModelConfig,
  DreamCycleState,
  SkillStatus,
} from './types';
import {
  MOCK_AGENTS,
  MOCK_WALLET_DATA,
  MOCK_SKILLS_DATA,
  MOCK_CREDIT_MODEL_DATA,
  DEFAULT_CREDIT_MODEL,
  MOCK_DREAM_CYCLE_DATA,
  MOCK_OWNER_ADDRESS,
} from './mockData';
import {
  fetchLiveAgentStatus,
  checkGatewayHealth,
  fetchRecentTelemetry,
  submitTelemetryEvent,
  IngestedTraceEvent,
  fetchRegisteredAgents,
  registerAgent as registerGatewayAgent,
  RegisterAgentInput,
  RegisteredAgentProjection,
} from './api/agentGateway';

interface PortalContextType {
  authenticated: boolean;
  activeWallet: string;
  login: () => void;
  logout: () => void;
  agents: StudioAgent[];
  getAgentById: (id: string) => StudioAgent | undefined;
  getWalletData: (agentId: string) => AgentWalletData;
  withdrawFunds: (agentId: string, amount: number) => Promise<{ success: boolean; txHash: string }>;
  getSkills: (agentId: string) => SkillItem[];
  addSkill: (agentId: string, skill: Omit<SkillItem, 'id' | 'created_at'>) => void;
  updateSkillStatus: (agentId: string, skillId: string, status: SkillStatus) => void;
  getCreditModel: (agentId: string) => CreditModelConfig;
  updateCreditModel: (agentId: string, config: Partial<CreditModelConfig>) => void;
  getDreamCycleState: (agentId: string) => DreamCycleState;
  linkDreamCycle: (agentId: string, hypermoveAgentId: string) => Promise<{ success: boolean; error?: string }>;
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
  sendTestTelemetry: (agentId?: string) => Promise<void>;
  registerAgent: (input: RegisterAgentInput) => Promise<{ ok: boolean; agentId?: string; agentKey?: string; error?: string }>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [authenticated, setAuthenticated] = useState<boolean>(true);
  const [activeWallet, setActiveWallet] = useState<string>(MOCK_OWNER_ADDRESS);
  const [agents, setAgents] = useState<StudioAgent[]>(MOCK_AGENTS);
  const [walletData, setWalletData] = useState<Record<string, AgentWalletData>>(MOCK_WALLET_DATA);
  const [skillsData, setSkillsData] = useState<Record<string, SkillItem[]>>(MOCK_SKILLS_DATA);
  const [creditModelData, setCreditModelData] = useState<Record<string, CreditModelConfig>>(MOCK_CREDIT_MODEL_DATA);
  const [dreamCycleData, setDreamCycleData] = useState<Record<string, DreamCycleState>>(MOCK_DREAM_CYCLE_DATA);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [gatewayOnline, setGatewayOnline] = useState<boolean>(false);
  const [telemetryEvents, setTelemetryEvents] = useState<IngestedTraceEvent[]>([]);
  const [isLiveByAgent, setIsLiveByAgent] = useState<Record<string, boolean>>({});

  const projectGatewayAgent = (agent: RegisteredAgentProjection): StudioAgent => ({
    id: agent.agent_id,
    slug: agent.slug,
    display_name: agent.display_name,
    description: agent.description || 'Connected local agent. Financial and reputation data are unavailable.',
    training_stage: 0,
    owner_address: agent.owner_address || 'Unverified owner',
    kpis: { revenue_usdc_mtd: 0, hires_mtd: 0, reputation_score: 0, credits_earned_usdc_mtd: 0 },
    pending_actions: { dream_diffs_pending: 0, federation_broadcasts_pending: 0 },
    created_at: agent.registered_at,
    connection_state: agent.state,
    registration_source: agent.registration_source,
    last_seen_at: agent.last_seen_at,
    owner_verified: agent.owner_verified,
    is_demo: false,
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

      const registered = await fetchRegisteredAgents();
      // seam:portal-projection
      const agentsForSync = registered.length > 0
        ? [...MOCK_AGENTS.filter((agent) => !registered.some((record) => record.agent_id === agent.id)), ...registered.map(projectGatewayAgent)]
        : MOCK_AGENTS;
      if (isMounted && registered.length > 0) {
        setAgents((previous) => {
          const gatewayIds = new Set(registered.map((agent) => agent.agent_id));
          const demos = previous.filter((agent) => !gatewayIds.has(agent.id));
          return [...demos, ...registered.map(projectGatewayAgent)];
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
                  ...(prev[agent.id] || MOCK_DREAM_CYCLE_DATA[agent.id]),
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

            // Live withdrawable balance
            if (live.credits && live.credits.balance_usdc) {
              const balanceNum = parseFloat(live.credits.balance_usdc);
              if (!isNaN(balanceNum) && balanceNum > 0) {
                setWalletData((prev) => ({
                  ...prev,
                  [agent.id]: {
                    ...(prev[agent.id] || MOCK_WALLET_DATA[agent.id]),
                    total_withdrawable_usdc: balanceNum,
                  },
                }));
              }
            }
          }
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
      cost_usdc: '0.012',
      summary: 'Manual heartbeat test event sent from Connect Console',
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
    showToast('Agent registered. Save the one-time key before leaving this page.', 'success');
    return { ok: true, agentId: result.agent.agent_id, agentKey: result.agentKey };
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  const clearNotification = () => setNotification(null);

  const login = () => {
    setAuthenticated(true);
    setActiveWallet(MOCK_OWNER_ADDRESS);
    showToast('Signed in with wallet ' + MOCK_OWNER_ADDRESS.slice(0, 6) + '...' + MOCK_OWNER_ADDRESS.slice(-4), 'info');
  };

  const logout = () => {
    setAuthenticated(false);
    showToast('Signed out', 'info');
  };

  const getAgentById = (id: string) => {
    return agents.find((a) => a.id === id || a.slug === id);
  };

  const getWalletData = (agentId: string): AgentWalletData => {
    return (
      walletData[agentId] || {
        total_withdrawable_usdc: 0,
        breakdown: { credit_share_usdc: 0, x402_direct_usdc: 0, sub_agent_earnings_usdc: 0 },
        withdraw_threshold_usdc: 5.0,
        withdraw_cooldown_active: false,
        last_withdraw_at: null,
        ledger: [],
      }
    );
  };

  const withdrawFunds = async (agentId: string, amount: number) => {
    const current = getWalletData(agentId);
    if (amount > current.total_withdrawable_usdc) {
      showToast('Requested amount exceeds available balance', 'error');
      return { success: false, txHash: '' };
    }
    if (current.total_withdrawable_usdc < current.withdraw_threshold_usdc) {
      showToast(`Minimum withdrawal threshold is $${current.withdraw_threshold_usdc.toFixed(2)} USDC`, 'error');
      return { success: false, txHash: '' };
    }

    const txHash = '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6);
    
    setWalletData((prev) => {
      const existing = prev[agentId] || MOCK_WALLET_DATA[agentId];
      return {
        ...prev,
        [agentId]: {
          ...existing,
          total_withdrawable_usdc: Math.max(0, existing.total_withdrawable_usdc - amount),
          last_withdraw_at: new Date().toISOString(),
          ledger: [
            {
              id: 'tx_with_' + Date.now(),
              timestamp: new Date().toISOString(),
              method: 'exact',
              caller_address: activeWallet,
              amount_usdc: amount,
              network: 'XRPL Testnet (RLUSD)',
              tx_hash: txHash,
              status: 'settled',
              description: 'Wallet balance withdrawal to creator account',
            },
            ...existing.ledger,
          ],
        },
      };
    });

    showToast(`Successfully initiated withdrawal of $${amount.toFixed(2)} RLUSD`, 'success');
    return { success: true, txHash };
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
    return dreamCycleData[agentId] || MOCK_DREAM_CYCLE_DATA['openx-defi-analyst-01'];
  };

  const linkDreamCycle = async (agentId: string, hypermoveAgentId: string) => {
    if (!hypermoveAgentId.trim()) {
      return { success: false, error: 'HyperMove Agent ID cannot be empty' };
    }

    return { success: false, error: 'Dream Cycle verification is not configured on the Gateway yet.' };
  };

  const flagSupplierCandidate = (agentId: string, skillId: string) => {
    setDreamCycleData((prev) => {
      const current = prev[agentId] || MOCK_DREAM_CYCLE_DATA[agentId];
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
        authenticated,
        activeWallet,
        login,
        logout,
        agents,
        getAgentById,
        getWalletData,
        withdrawFunds,
        getSkills,
        addSkill,
        updateSkillStatus,
        getCreditModel,
        updateCreditModel,
        getDreamCycleState,
        linkDreamCycle,
        flagSupplierCandidate,
        notification,
        clearNotification,
        showToast,
        theme,
        toggleTheme,
        gatewayOnline,
        telemetryEvents,
        isLiveByAgent,
        sendTestTelemetry,
        registerAgent,
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
