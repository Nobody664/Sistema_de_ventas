'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpgradeRequiredProps {
  featureLabel?: string | null;
  canUpgrade?: boolean;
}

export function UpgradeRequired({ featureLabel, canUpgrade = true }: UpgradeRequiredProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg rounded-[34px] bg-white/85 p-8 text-center animate-fade-in-up">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-500/15">
          <Lock className="size-7 text-orange-500" />
        </div>
        <h1 className="mt-5 font-display text-2xl">Función no incluida en tu plan</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/60">
          {featureLabel
            ? `La función “${featureLabel}” no está incluida en tu plan actual.`
            : 'Esta sección no está incluida en tu plan actual.'}
          {canUpgrade
            ? ' Mejora tu plan para desbloquearla.'
            : ' Solicita a un administrador de tu empresa que mejore el plan para desbloquearla.'}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/dashboard">Volver al dashboard</Link>
          </Button>
          {canUpgrade && (
            <Button asChild>
              <Link href="/subscription">Ver planes</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
