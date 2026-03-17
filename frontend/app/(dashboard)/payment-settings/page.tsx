import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { PaymentSettingsManager } from '@/components/settings/payment-settings';
import { CreditCard, Shield, ArrowLeft } from 'lucide-react';

export default async function PaymentSettingsPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  
  if (!roles.includes('SUPER_ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/settings"
          className="flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Configuración
        </Link>
      </div>

      <Card className="rounded-[34px] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/10 p-3">
            <CreditCard className="size-8" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Administración</p>
            <h1 className="mt-1 font-display text-4xl">Métodos de Pago</h1>
            <p className="mt-1 text-white/60">Configura Yape, Stripe, MercadoPago y más</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-[30px] bg-amber-50 border-amber-200 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h3 className="font-medium text-amber-800">Solo para SUPER_ADMIN</h3>
            <p className="text-sm text-amber-700">
              Esta configuración es global y afecta a todas las empresas del sistema.
            </p>
          </div>
        </div>
      </Card>

      <PaymentSettingsManager />
    </div>
  );
}
