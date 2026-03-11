'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <AlertTriangle className="size-8 text-red-600" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">Algo salió mal</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Ha ocurrido un error inesperado. Por favor, intenta de nuevo.
        </p>
      </div>
      <Button onClick={reset} className="mt-2">
        <RefreshCw className="mr-2 size-4" />
        Intentar de nuevo
      </Button>
    </div>
  );
}
