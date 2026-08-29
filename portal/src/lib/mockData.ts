import { StudioAgent, SkillItem, CreditModelConfig, DreamCycleState } from './types';

export const MOCK_OWNER_ADDRESS = '0x8f3C785B0B2E6A17e914041b312bBc92651B5A44';

export const MOCK_AGENTS: StudioAgent[] = [
  {
    id: 'f8b2d1c9-724e-4f16-9562-581335b2df01',
    slug: 'defi-deep-research-analyst',
    display_name: 'DeFi Deep Research Analyst',
    description: 'Long-horizon market intelligence agent with automated XRPL x402 micropayments and on-chain protocol analysis.',
    training_stage: 4, // Dreamed
    owner_address: MOCK_OWNER_ADDRESS,
    hypermove_dream_agent_id: 'hypermove_agent_defi_analyst_09',
    pending_actions: {
      dream_diffs_pending: 2,
      federation_broadcasts_pending: 0,
    },
    created_at: '2026-06-15T08:00:00Z',
  },
  {
    id: 'b1178c43-2289-4fae-9d22-8819273c55ee',
    slug: 'solidity-fhe-auditor',
    display_name: 'Solidity & FHE Security Auditor',
    description: 'Static analysis and cryptographic privacy verifier for Fhenix/Zama homomorphic encrypted contracts.',
    training_stage: 1, // SkillsAdded (Unlinked to Dream Cycle)
    owner_address: MOCK_OWNER_ADDRESS,
    hypermove_dream_agent_id: null,
    pending_actions: {
      dream_diffs_pending: 0,
      federation_broadcasts_pending: 0,
    },
    created_at: '2026-08-10T14:15:00Z',
  },
];

export const MOCK_SKILLS_DATA: Record<string, SkillItem[]> = {
  'f8b2d1c9-724e-4f16-9562-581335b2df01': [
    {
      id: 'skill_01',
      name: 'xrpl-x402-payment-rail',
      slug: 'xrpl-x402-payment-rail',
      description: 'Micro-settlement client for high-frequency XRPL DEX market data feeds via x402 protocol headers.',
      status: 'active',
      version: 'v2.1.0',
      trigger_patterns: ['x402_payment', 'xrpl_quote', 'orderbook_premium'],
      audit_last_run: '2026-08-22T04:00:00Z',
      audit_score: 99.2,
      created_at: '2026-06-20T00:00:00Z',
      author: 'OpenX Core Engine',
      source: 'local',
    },
    {
      id: 'skill_02',
      name: 'defi-liquidity-synthesizer',
      slug: 'defi-liquidity-synthesizer',
      description: 'Calculates net yield APY and impermanent loss risk curves across Uniswap v3 and Curve pools.',
      status: 'active',
      version: 'v1.4.2',
      trigger_patterns: ['liquidity_depth', 'yield_forecast', 'pool_audit'],
      audit_last_run: '2026-08-21T18:30:00Z',
      audit_score: 96.8,
      created_at: '2026-07-02T10:00:00Z',
      author: 'Pham Nim (Creator)',
      source: 'local',
    },
    {
      id: 'skill_03',
      name: 'hypermove-dream-memory-hook',
      slug: 'hypermove-dream-memory-hook',
      description: 'Synchronizes offline episodic logs with HyperMove REM memory consolidation engine.',
      status: 'active',
      version: 'v1.0.0',
      trigger_patterns: ['dream_sync', 'memory_reconstruct', 'wake_brief'],
      audit_last_run: '2026-08-22T06:00:00Z',
      audit_score: 98.0,
      created_at: '2026-08-01T15:00:00Z',
      author: 'HyperMove Core',
      source: 'hypermove_promoted',
    },
    {
      id: 'skill_04',
      name: 'legacy-coingecko-scraper',
      slug: 'legacy-coingecko-scraper',
      description: 'Fallback rate scraper using legacy public APIs without cryptographic signature verification.',
      status: 'deprecated',
      version: 'v0.9.1',
      trigger_patterns: ['price_lookup_legacy'],
      audit_last_run: '2026-07-15T00:00:00Z',
      audit_score: 72.4,
      created_at: '2026-05-10T12:00:00Z',
      author: 'Community',
      source: 'marketplace_fork',
    },
  ],
  'b1178c43-2289-4fae-9d22-8819273c55ee': [
    {
      id: 'skill_21',
      name: 'solidity-ast-parser',
      slug: 'solidity-ast-parser',
      description: 'Extracts execution control flow graphs and checks for re-entrancy / integer bounds.',
      status: 'in_audit',
      version: 'v0.1.0',
      trigger_patterns: ['ast_parse', 'ast_check'],
      audit_last_run: null,
      created_at: '2026-08-12T00:00:00Z',
      author: 'Auditor Dev',
      source: 'local',
    },
  ],
};

export const DEFAULT_CREDIT_MODEL: CreditModelConfig = {
  price_usdc: 0.05,
  free_trial_calls: 0,
  per_buyer_daily_limit: 0,
  revenue_share_percentage: 85,
  updated_at: new Date(0).toISOString(),
};

export const MOCK_CREDIT_MODEL_DATA: Record<string, CreditModelConfig> = {
  'f8b2d1c9-724e-4f16-9562-581335b2df01': {
    price_usdc: 0.05,
    free_trial_calls: 3,
    per_buyer_daily_limit: 100,
    revenue_share_percentage: 85,
    updated_at: '2026-08-20T10:00:00Z',
  },
  'b1178c43-2289-4fae-9d22-8819273c55ee': {
    price_usdc: 0.10,
    free_trial_calls: 2,
    per_buyer_daily_limit: 20,
    revenue_share_percentage: 85,
    updated_at: '2026-08-10T14:00:00Z',
  },
};

export const MOCK_DREAM_CYCLE_DATA: Record<string, DreamCycleState> = {
  'f8b2d1c9-724e-4f16-9562-581335b2df01': {
    is_linked: true,
    hypermove_dream_agent_id: 'hypermove_agent_defi_analyst_09',
    rem_state: 'ACTIVE_REM',
    last_cycle_at: '2026-08-22T06:14:22Z',
    cycle_count_total: 42,
    memory_nodes_total: 12480,
    wake_context: {
      active_memory_buffer_mb: 24.6,
      long_term_embeddings: 8400,
      last_morning_brief_summary: 'Consolidated 128 market execution episodes. Identified 3 recurring high-slippage patterns in XRPL DEX liquidity pool routing; synthesized new candidate skill for automated fee optimization.',
    },
    learning_queue: [
      { id: 'q1', topic: 'XRPL atomic transaction slippage bounds', priority: 'high', progress_pct: 82 },
      { id: 'q2', topic: 'FHE Encrypted order book latency optimization', priority: 'medium', progress_pct: 45 },
      { id: 'q3', topic: 'Zero-knowledge proof verification speedups', priority: 'low', progress_pct: 20 },
    ],
    diagnostics: [
      { episode_id: 'ep_42_01', timestamp: '2026-08-22T06:10:00Z', duration_sec: 180, loss_entropy: 0.042, synthesized_insights: 14, status: 'converged' },
      { episode_id: 'ep_41_08', timestamp: '2026-08-21T06:00:00Z', duration_sec: 210, loss_entropy: 0.058, synthesized_insights: 9, status: 'converged' },
      { episode_id: 'ep_40_12', timestamp: '2026-08-20T06:05:00Z', duration_sec: 195, loss_entropy: 0.051, synthesized_insights: 11, status: 'converged' },
    ],
    skillify_candidates: [
      {
        skill_id: 'hm_skill_xrpl_guard',
        name: 'xrpl-dex-route-guard',
        description: 'Auto-detects DEX pool congestion anomalies and calculates optimal batching windows to minimize execution slippage.',
        confidence_score: 97.4,
        artifact_hash: '0x8f2a991c4be8...10f1',
        candidate_status: 'pending_human_review',
        synthesized_at: '2026-08-22T06:14:00Z',
      },
      {
        skill_id: 'hm_skill_rlusd_spread',
        name: 'rlusd-volatility-hedger',
        description: 'Autonomous delta-neutral hedging trigger on Ripple USD stablecoin liquidity pools.',
        confidence_score: 92.1,
        artifact_hash: '0x3c7100ea88ff...99a2',
        candidate_status: 'unflagged',
        synthesized_at: '2026-08-21T06:00:00Z',
      },
    ],
  },
  'b1178c43-2289-4fae-9d22-8819273c55ee': {
    is_linked: false,
    hypermove_dream_agent_id: null,
    rem_state: 'IDLE',
    last_cycle_at: '',
    cycle_count_total: 0,
    memory_nodes_total: 0,
    wake_context: {
      active_memory_buffer_mb: 0,
      long_term_embeddings: 0,
      last_morning_brief_summary: 'Agent not linked to HyperMove Dream Cycle.',
    },
    learning_queue: [],
    diagnostics: [],
    skillify_candidates: [],
  },
};
