import React from 'react';
import { Sparkles, ArrowRight, ListOrdered, CheckCircle2 } from 'lucide-react';

interface LearningQueueViewProps {
  queue: Array<{
    id: string;
    topic: string;
    priority: 'high' | 'medium' | 'low';
    progress_pct: number;
  }>;
}

export function LearningQueueView({ queue }: LearningQueueViewProps) {
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="rounded bg-error/15 text-error px-1.5 py-0.5 font-mono text-[10px] font-bold border border-error/30">HIGH</span>;
      case 'medium':
        return <span className="rounded bg-primary/15 text-primary px-1.5 py-0.5 font-mono text-[10px] font-bold border border-primary/30">MED</span>;
      case 'low':
        return <span className="rounded bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 font-mono text-[10px] font-bold border border-outline-variant/30">LOW</span>;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-agent-accent" />
          <h3 className="font-headline text-base font-bold text-on-surface">Active Task Chains & Learning Queue</h3>
        </div>
        <span className="font-mono text-xs text-on-surface-variant">{queue.length} Active Targets</span>
      </div>

      <div className="space-y-3">
        {queue.length === 0 ? (
          <p className="text-xs text-on-surface-variant py-4 text-center">No active learning tasks in queue.</p>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-outline-variant/20 bg-surface-container/60 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-on-surface font-body">{item.topic}</span>
                {getPriorityBadge(item.priority)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                  <span>Replay Consolidation</span>
                  <span className="font-bold text-primary">{item.progress_pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-agent-accent to-primary transition-all duration-500"
                    style={{ width: `${item.progress_pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
