'use client';

import React, { useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { SkillsTable } from '@/components/skills/SkillsTable';
import { SkillUploadModal } from '@/components/skills/SkillUploadModal';
import { SetupChecklist } from '@/components/common/SetupChecklist';

export default function SkillsPage({ params }: { params: { agentId: string } }) {
  const { getSkills, updateSkillStatus } = usePortal();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const skills = getSkills(params.agentId);
  const activeSkills = skills.filter((s) => s.status === 'active');

  const checklistSteps = [
    {
      id: 'step_first_skill',
      title: 'Attach your first execution tool',
      description: 'Upload a SKILL.md specification to enable autonomous execution by buyers',
      done: skills.length > 0,
      actionText: 'Upload SKILL.md',
      onClick: () => setUploadModalOpen(true),
    },
    {
      id: 'step_audit',
      title: 'Pass cryptographic security & input verification',
      description: 'Run automated audit check to guarantee tool safety and rate limit compliance',
      done: skills.some((s) => s.audit_last_run !== null),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Zero Skills Checklist */}
      {skills.length === 0 && (
        <SetupChecklist
          title="Agent Capability Setup"
          subtitle="Configure autonomous skills and execution manifests"
          steps={checklistSteps}
        />
      )}

      {/* Main Skills Table */}
      <SkillsTable
        skills={skills}
        onStatusChange={(skillId, newStatus) => updateSkillStatus(params.agentId, skillId, newStatus)}
        onOpenUpload={() => setUploadModalOpen(true)}
      />

      {/* Upload Modal */}
      <SkillUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        agentId={params.agentId}
      />
    </div>
  );
}
