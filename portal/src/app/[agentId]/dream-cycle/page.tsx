'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { DreamLinkCTA } from '@/components/dream-cycle/DreamLinkCTA';
import { DreamTelemetry } from '@/components/dream-cycle/DreamTelemetry';
import { LearningQueueView } from '@/components/dream-cycle/LearningQueueView';
import { SkillifyBoardView } from '@/components/dream-cycle/SkillifyBoardView';

export default function DreamCyclePage({ params }: { params: { agentId: string } }) {
  const { getDreamCycleState } = usePortal();
  const state = getDreamCycleState(params.agentId);

  // If not linked to HyperMove agent_id, render server-verified linking CTA
  if (!state.is_linked) {
    return <DreamLinkCTA agentId={params.agentId} />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Real-time REM State & Wake Telemetry */}
      <DreamTelemetry agentId={params.agentId} state={state} />

      {/* 2. Autonomous Skillify Synthesis Board (Human Review Gated) */}
      <SkillifyBoardView agentId={params.agentId} candidates={state.skillify_candidates} />

      {/* 3. Learning Queue & Replay Task Chains */}
      <LearningQueueView queue={state.learning_queue} />
    </div>
  );
}
