'use client';

import React from 'react';
import { Check, Copy, Database, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { DreamLesson, DreamLessonProof, fetchDreamLessonProof } from '@/lib/api/agentGateway';

export function ZeroGMemoryVaultView({ agentId, lessons }: { agentId: string; lessons: DreamLesson[] }) {
  const promoted = lessons.filter((lesson) => lesson.state === 'PROMOTED_CONSTRAINT');
  const pinned = promoted.filter((lesson) => lesson.zerog_provenance?.status === 'uploaded');
  const [proof, setProof] = React.useState<DreamLessonProof | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const inspect = async (lesson: DreamLesson) => {
    setLoading(lesson.id);
    setProof(await fetchDreamLessonProof(agentId, lesson.id));
    setLoading(null);
  };
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 space-y-4" aria-label="0G decentralized memory vault">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Database className="h-4 w-4 text-secondary" /><div><h3 className="font-headline text-sm font-bold text-on-surface">0G Decentralized Memory Vault</h3><p className="text-xs text-on-surface-variant">Gateway-verified provenance for promoted REM constraints</p></div></div>
        <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 font-mono text-[10px] text-secondary">{pinned.length}/{promoted.length} pinned</span>
      </div>
      {promoted.length === 0 ? <p className="text-xs text-on-surface-variant">Promote a reviewed Dream lesson to create a 0G provenance record.</p> : <div className="space-y-2">{promoted.map((lesson) => {
        const provenance = lesson.zerog_provenance;
        const uploaded = provenance?.status === 'uploaded';
        return <div key={lesson.id} className="rounded-xl border border-outline-variant/20 bg-surface-container/50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="text-xs leading-relaxed text-on-surface">{lesson.content}</p><p className="mt-1 font-mono text-[10px] text-on-surface-variant">{provenance?.root_hash ? `${provenance.root_hash.slice(0, 14)}…` : provenance?.message || 'Waiting for 0G archive'}</p></div>
          <div className="flex shrink-0 items-center gap-2">{uploaded ? <><ShieldCheck className="h-4 w-4 text-secondary" aria-label="0G verified" />{provenance?.explorer_url && <a className="text-secondary" href={provenance.explorer_url} target="_blank" rel="noreferrer" aria-label="Open 0G transaction"><ExternalLink className="h-4 w-4" /></a>}<button className="rounded-lg border border-outline-variant/30 px-2 py-1 text-[11px] text-on-surface hover:bg-surface-container-high" onClick={() => void inspect(lesson)}>{loading === lesson.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'View proof'}</button></> : <span className="text-[11px] text-warning">{provenance?.status === 'failed' ? 'Archive failed' : 'Archiving…'}</span>}</div>
        </div>;
      })}</div>}
      {proof && <div role="dialog" aria-modal="true" className="rounded-xl border border-secondary/30 bg-surface-container-high p-4 space-y-3"><div className="flex justify-between gap-3"><div><p className="font-headline text-sm font-bold text-on-surface">Merkle proof verified</p><p className="text-xs text-on-surface-variant">The Gateway retrieved and decrypted the stored envelope before returning it.</p></div><button className="text-xs text-on-surface-variant" onClick={() => setProof(null)}>Close</button></div><pre className="max-h-56 overflow-auto rounded-lg bg-surface-container-lowest p-3 text-[10px] text-on-surface whitespace-pre-wrap">{JSON.stringify(proof.canonical_payload, null, 2)}</pre><button className="inline-flex items-center gap-1 text-xs text-secondary" onClick={() => void copy(JSON.stringify(proof.canonical_payload))}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Copied' : 'Copy envelope'}</button></div>}
    </section>
  );
}
