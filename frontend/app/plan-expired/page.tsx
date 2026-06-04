import { AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function PlanExpiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-500/20">
          <AlertCircle className="size-8 text-red-400" />
        </div>

        <h1 className="mt-6 font-display text-2xl text-white">Tu prueba gratis ha expirado</h1>
        <p className="mt-3 text-sm leading-7 text-white/50">
          El período de prueba de tu cuenta ha terminado. Para seguir usando el sistema, adquiere uno de nuestros planes.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/pricing"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Ver planes disponibles
            <ArrowRight className="size-4" />
          </Link>

          <Link
            href="/sign-in"
            className="block text-sm text-white/40 transition hover:text-white/60"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      </Card>
    </main>
  );
}
