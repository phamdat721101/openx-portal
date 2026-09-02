export interface StudioAgent {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  training_stage: number; // 0: Onboarded, 1: SkillsAdded, 2: Evaluated, 3: Orchestrator, 4: Dreamed
  owner_address: string;
  hypermove_dream_agent_id?: string | null;
  pending_actions: {
    dream_diffs_pending: number;
    federation_broadcasts_pending: number;
  };
  created_at: string;
  connection_state?: 'registered' | 'online' | 'offline' | 'auto_discovered' | 'revoked';
  registration_source?: 'explicit' | 'auto_discovered';
  last_seen_at?: string | null;
  owner_verified?: boolean;
  is_demo?: boolean;
}

export type SkillStatus = 'active' | 'in_audit' | 'deprecated';

export interface SkillTelemetry {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  avg_latency_ms: number | null;
  last_called_at: string | null;
}

export interface SkillItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: SkillStatus;
  version: string;
  trigger_patterns: string[];
  audit_last_run: string | null;
  audit_score?: number | null;
  created_at: string;
  author: string;
  source: 'local' | 'hypermove_promoted' | 'marketplace_fork';
  telemetry?: SkillTelemetry;
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
  brain_snapshot?: {
    episodes: number;
    facts: number;
    skills: number;
    activity14d: number[];
    lastQueryAt: string | null;
  };
}
