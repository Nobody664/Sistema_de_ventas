'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { apiFetch, getAccessToken } from '@/lib/api';

type CompletenessData = {
  score: number;
  totalFields: number;
  completedFields: number;
  missingFields: string[];
};

export function ProfileCompletenessIndicator() {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiFetch<CompletenessData>('/company-profile/completeness', { token })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.score >= 100) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 shrink-0">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#fde68a" strokeWidth="2.5" />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none" stroke="#d97706"
                  strokeWidth="2.5"
                  strokeDasharray={`${data.score * 0.96} 96`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-700">
                {data.score}%
              </span>
            </div>
            <div>
              <p className="font-semibold text-amber-800">
                Perfil {data.score}% completo
              </p>
              <p className="text-xs text-amber-600">
                {data.completedFields} de {data.totalFields} campos completados
              </p>
            </div>
          </div>
          {data.missingFields.length > 0 && (
            <ul className="mt-3 space-y-1">
              {data.missingFields.map((field) => (
                <li key={field} className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Falta: {field}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/settings/company"
          className="ml-4 flex shrink-0 items-center gap-1 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          Completar
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
