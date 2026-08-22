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
  MOCK_DREAM_CYCLE_DATA,
  MOCK_OWNER_ADDRESS,
} from './mockData';

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
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean>(true);
  const [activeWallet, setActiveWallet] = useState<string>(MOCK_OWNER_ADDRESS);
  const [agents, setAgents] = useState<StudioAgent[]>(MOCK_AGENTS);
  const [walletData, setWalletData] = useState<Record<string, AgentWalletData>>(MOCK_WALLET_DATA);
  const [skillsData, setSkillsData] = useState<Record<string, SkillItem[]>>(MOCK_SKILLS_DATA);
  const [creditModelData, setCreditModelData] = useState<Record<string, CreditModelConfig>>(MOCK_CREDIT_MODEL_DATA);
  const [dreamCycleData, setDreamCycleData] = useState<Record<string, DreamCycleState>>(MOCK_DREAM_CYCLE_DATA);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
      const existing = prev[agentId] || current;
      return {
        ...prev,
        [agentId]: {
          ...existing,
          total_withdrawable_usdc: Math.max(0, existing.total_withdrawable_usdc - amount),
          last_withdraw_at: new Date().toISOString(),
          ledger: [
            {
              id: 'tx_' + Date.now(),
              tx_hash: txHash,
              timestamp: new Date().toISOString(),
              method: 'credit',
              caller_address: activeWallet,
              amount_usdc: -amount,
              status: 'settled',
              network: 'Arbitrum One',
              description: `Withdrawal to owner wallet (${amount.toFixed(2)} USDC)`,
            },
            ...existing.ledger,
          ],
        },
      };
    });

    showToast(`Successfully withdrawn $${amount.toFixed(2)} USDC (Tx: ${txHash})`, 'success');
    return { success: true, txHash };
  };

  const getSkills = (agentId: string): SkillItem[] => {
    return skillsData[agentId] || [];
  };

  const addSkill = (agentId: string, skill: Omit<SkillItem, 'id' | 'created_at'>) => {
    const newSkill: SkillItem = {
      ...skill,
      id: 'skill_' + Date.now(),
      created_at: new Date().toISOString(),
    };

    setSkillsData((prev) => ({
      ...prev,
      [agentId]: [newSkill, ...(prev[agentId] || [])],
    }));

    showToast(`Skill "${skill.name}" installed successfully`, 'success');
  };

  const updateSkillStatus = (agentId: string, skillId: string, status: SkillStatus) => {
    setSkillsData((prev) => {
      const list = prev[agentId] || [];
      return {
        ...prev,
        [agentId]: list.map((s) => (s.id === skillId ? { ...s, status } : s)),
      };
    });

    showToast(`Skill status updated to "${status}"`, 'info');
  };

  const getCreditModel = (agentId: string): CreditModelConfig => {
    return (
      creditModelData[agentId] || {
        price_usdc: 0.05,
        free_trial_calls: 0,
        per_buyer_daily_limit: 100,
        revenue_share_percentage: 85,
        updated_at: new Date().toISOString(),
      }
    );
  };

  const updateCreditModel = (agentId: string, config: Partial<CreditModelConfig>) => {
    setCreditModelData((prev) => {
      const existing = prev[agentId] || getCreditModel(agentId);
      return {
        ...prev,
        [agentId]: {
          ...existing,
          ...config,
          updated_at: new Date().toISOString(),
        },
      };
    });

    showToast('Pricing and credit rules saved successfully', 'success');
  };

  const getDreamCycleState = (agentId: string): DreamCycleState => {
    return (
      dreamCycleData[agentId] || {
        is_linked: false,
        hypermove_dream_agent_id: null,
        rem_state: 'IDLE',
        last_cycle_at: '',
        cycle_count_total: 0,
        memory_nodes_total: 0,
        wake_context: {
          active_memory_buffer_mb: 0,
          long_term_embeddings: 0,
          last_morning_brief_summary: 'Not linked',
        },
        learning_queue: [],
        diagnostics: [],
        skillify_candidates: [],
      }
    );
  };

  const linkDreamCycle = async (agentId: string, hypermoveAgentId: string) => {
    if (!hypermoveAgentId.startsWith('hypermove_agent_')) {
      showToast('Validation failed: agent_id not found in your HyperMove session', 'error');
      return { success: false, error: 'Agent ID is not registered under your HyperMove session' };
    }

    setDreamCycleData((prev) => ({
      ...prev,
      [agentId]: {
        is_linked: true,
        hypermove_dream_agent_id: hypermoveAgentId,
        rem_state: 'ACTIVE_REM',
        last_cycle_at: new Date().toISOString(),
        cycle_count_total: 1,
        memory_nodes_total: 1200,
        wake_context: {
          active_memory_buffer_mb: 4.5,
          long_term_embeddings: 950,
          last_morning_brief_summary: 'Initial connection verified. Commencing background REM consolidation of recent tool calls and memory nodes.',
        },
        learning_queue: [
          { id: 'q_init_1', topic: 'Episodic memory consolidation & indexing', priority: 'high', progress_pct: 35 },
        ],
        diagnostics: [
          { episode_id: 'ep_init_01', timestamp: new Date().toISOString(), duration_sec: 90, loss_entropy: 0.08, synthesized_insights: 3, status: 'converged' },
        ],
        skillify_candidates: [],
      },
    }));

    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, hypermove_dream_agent_id: hypermoveAgentId, training_stage: 4 } : a))
    );

    showToast(`Successfully linked to HyperMove agent "${hypermoveAgentId}"`, 'success');
    return { success: true };
  };

  const flagSupplierCandidate = (agentId: string, skillId: string) => {
    setDreamCycleData((prev) => {
      const current = prev[agentId];
      if (!current) return prev;
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
