export interface StudioAgent {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  training_stage: number; // 0: Onboarded, 1: SkillsAdded, 2: Evaluated, 3: Orchestrator, 4: Dreamed
  owner_address: string;
  hypermove_dream_agent_id?: string | null;
  kpis: {
    revenue_usdc_mtd: number;
    hires_mtd: number;
    reputation_score: number;
    credits_earned_usdc_mtd: number;
  };
  pending_actions: {
    dream_diffs_pending: number;
    federation_broadcasts_pending: number;
  };
  created_at: string;
}

export interface StudioAgentList {
  agents: StudioAgent[];
  aggregate: {
    total_revenue_usdc_mtd: number;
    total_hires_mtd: number;
    avg_reputation_score: number;
  };
}

export interface WalletBreakdown {
  credit_share_usdc: number;
  x402_direct_usdc: number;
  sub_agent_earnings_usdc: number;
}

export interface LedgerItem {
  id: string;
  tx_hash: string;
  timestamp: string;
  method: 'credit' | 'exact' | 'sub_agent';
  caller_address: string;
  amount_usdc: number;
  status: 'settled' | 'pending' | 'failed';
  network: string;
  description: string;
}

export interface AgentWalletData {
  total_withdrawable_usdc: number;
  breakdown: WalletBreakdown;
  withdraw_threshold_usdc: number;
  withdraw_cooldown_active: boolean;
  last_withdraw_at: string | null;
  ledger: LedgerItem[];
}

export type SkillStatus = 'active' | 'draft' | 'deprecated';

export interface SkillItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: SkillStatus;
  version: string;
  trigger_patterns: string[];
  audit_last_run: string | null;
  audit_score?: number;
  created_at: string;
  author: string;
  source: 'local' | 'hypermove_promoted' | 'marketplace_fork';
}

export interface CreditModelConfig {
  price_usdc: number;
  free_trial_calls: number;
  per_buyer_daily_limit: number;
  revenue_share_percentage: number;
  updated_at: string;
}

export interface DreamEpisodeDiagnostic {
  episode_id: string;
  timestamp: string;
  duration_sec: number;
  loss_entropy: number;
  synthesized_insights: number;
  status: 'converged' | 'evaluating' | 'failed';
}

export interface PromotedDreamSkill {
  skill_id: string;
  name: string;
  description: string;
  confidence_score: number;
  artifact_hash: string;
  candidate_status: 'unflagged' | 'pending_human_review' | 'approved' | 'rejected';
  synthesized_at: string;
}

export interface DreamCycleState {
  is_linked: boolean;
  hypermove_dream_agent_id: string | null;
  rem_state: 'ACTIVE_REM' | 'IDLE' | 'CONSOLIDATING' | 'SYNTHESIZING';
  last_cycle_at: string;
  cycle_count_total: number;
  memory_nodes_total: number;
  wake_context: {
    active_memory_buffer_mb: number;
    long_term_embeddings: number;
    last_morning_brief_summary: string;
  };
  learning_queue: Array<{
    id: string;
    topic: string;
    priority: 'high' | 'medium' | 'low';
    progress_pct: number;
  }>;
  diagnostics: DreamEpisodeDiagnostic[];
  skillify_candidates: PromotedDreamSkill[];
}
