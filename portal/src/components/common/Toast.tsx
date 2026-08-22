'use client';

import React from 'react';
import { usePortal } from '@/lib/portalContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function Toast() {
  const { notification, clearNotification } = usePortal();

  if (!notification) return null;

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-error shrink-0" />,
    info: <Info className="h-4 w-4 text-primary shrink-0" />,
  };

  const borderStyles = {
    success: 'border-secondary/40 bg-surface-container-high/90 text-on-surface shadow-[0_0_20px_rgba(19,255,67,0.15)]',
    error: 'border-error/40 bg-surface-container-high/90 text-on-surface shadow-[0_0_20px_rgba(255,180,171,0.15)]',
    info: 'border-agent-accent/40 bg-surface-container-high/90 text-on-surface shadow-[0_0_20px_rgba(124,92,255,0.15)]',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 backdrop-blur-md ${borderStyles[notification.type]}`}>
        {icons[notification.type]}
        <span className="text-xs font-medium leading-tight">{notification.message}</span>
        <button
          onClick={clearNotification}
          className="ml-auto rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
