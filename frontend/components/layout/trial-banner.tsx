'use client';

import { X, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type TrialBannerProps = {
  companyStatus: string;
  trialEndsAt: string | null;
};

export function TrialBanner({ companyStatus, trialEndsAt }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (companyStatus !== 'TRIAL' || !trialEndsAt) return null;

  const now = Date.now();
  const trialEnd = new Date(trialEndsAt).getTime();
  const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60));

  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 1;

  return (
    <div className={`${isUrgent ? 'bg-red-600' : 'bg-amber-600'} text-white`}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-2.5 md:px-8">
        <div className="flex items-center gap-2 text-sm">
          {isUrgent ? (
            <AlertTriangle className="size-4 shrink-0" />
          ) : (
            <Clock className="size-4 shrink-0" />
          )}
          <span>
            {isUrgent
              ? `Tu prueba gratis termina en ${hoursLeft <= 1 ? 'menos de 1 hora' : `${hoursLeft} hora(s)`}.`
              : `Te quedan ${daysLeft} día(s) de prueba gratis.`}
          </span>
          <Link
            href="/subscriptions"
            className={`ml-2 rounded-full px-3 py-0.5 text-xs font-semibold ${
              isUrgent
                ? 'bg-white text-red-700 hover:bg-white/90'
                : 'bg-white/20 text-white hover:bg-white/30'
            } transition-colors`}
          >
            Ver planes
          </Link>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="cursor-pointer text-white/70 hover:text-white transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
