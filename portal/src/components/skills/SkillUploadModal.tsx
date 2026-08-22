'use client';

import React, { useState } from 'react';
import { usePortal } from '@/lib/portalContext';
import { X, UploadCloud, Terminal, FileCode, CheckCircle2 } from 'lucide-react';

interface SkillUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
}

export function SkillUploadModal({ isOpen, onClose, agentId }: SkillUploadModalProps) {
  const { addSkill } = usePortal();
  const [skillName, setSkillName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerPatternInput, setTriggerPatternInput] = useState('');
  const [version, setVersion] = useState('v1.0.0');
  const [markdownContent, setMarkdownContent] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;

    const patterns = triggerPatternInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    addSkill(agentId, {
      name: skillName.toLowerCase().replace(/\s+/g, '-'),
      slug: skillName.toLowerCase().replace(/\s+/g, '-'),
      description: description.trim() || 'Custom agent execution skill.',
      status: 'active',
      version: version.trim() || 'v1.0.0',
      trigger_patterns: patterns.length > 0 ? patterns : ['custom_trigger'],
      audit_last_run: new Date().toISOString(),
      audit_score: 98.5,
      author: 'Owner Custom',
      source: 'local',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-outline-variant/40 bg-surface-container-high p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="rounded-xl bg-primary/10 p-2 text-primary border border-primary/20">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-headline text-lg font-bold text-on-surface">Install New Skill (SKILL.md)</h2>
            <p className="text-xs text-on-surface-variant">Attach an autonomous capability or MCP tool to this agent</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                Skill Name (slug)
              </label>
              <input
                type="text"
                required
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g. uniswap-v3-arbitrage-runner"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0.0"
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
              Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this skill does when invoked by buyers"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
              Trigger Patterns (comma-separated keywords)
            </label>
            <input
              type="text"
              value={triggerPatternInput}
              onChange={(e) => setTriggerPatternInput(e.target.value)}
              placeholder="market_research, xrpl_swap, volatility_hedge"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">
              SKILL.md Markdown or Specification
            </label>
            <textarea
              rows={4}
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder={`---\nname: my-custom-skill\ndescription: Autonomous market execution\n---\n\n# Skill instructions`}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-mono text-on-surface focus:border-primary focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-outline-variant/40 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:bg-[#33f3ff] transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              Save & Attach Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
