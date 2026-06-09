'use client';

import { ScanBarcode } from 'lucide-react';

interface ScannerStatusProps {
  connected: boolean;
}

export function ScannerStatus({ connected }: ScannerStatusProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        connected
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500'
      }`}
    >
      <span
        className={`relative flex h-2 w-2 ${
          connected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        } rounded-full`}
      >
        {connected && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/60" />
        )}
      </span>
      <ScanBarcode className="h-3.5 w-3.5" />
      <span>{connected ? 'Escáner listo' : 'Escáner no detectado'}</span>
    </div>
  );
}
