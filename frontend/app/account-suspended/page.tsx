import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-8 text-center shadow-2xl shadow-black/50">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-500/20">
          <ShieldAlert className="size-8 text-amber-400" />
        </div>

        <h1 className="mt-6 font-display text-2xl text-white">Cuenta suspendida</h1>
        <p className="mt-3 text-sm leading-7 text-white/50">
          Tu cuenta ha sido suspendida por falta de pago. Contacta a soporte para reactivarla o realiza el pago pendiente.
        </p>

        <div className="mt-8 space-y-3">
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
