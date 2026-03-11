'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, QrCode, Smartphone, Loader2 } from 'lucide-react';

const plans = {
  START: { name: 'Start', price: 19, priceYearly: 190 },
  GROWTH: { name: 'Growth', price: 59, priceYearly: 590 },
  SCALE: { name: 'Scale', price: 149, priceYearly: 1490 },
};

interface RegisterFormData {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planCode = searchParams.get('plan') || 'GROWTH';
  const provider = searchParams.get('provider') || 'yape';
  
  const plan = plans[planCode as keyof typeof plans] || plans.GROWTH;
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    companyName: '',
    email: '',
    password: '',
  });

  const yapeNumber = '999888777';

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(yapeNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          planCode,
          paymentMethod: provider,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al registrar');
      }

      if (data.requiresApproval) {
        setStep('success');
      } else if (data.accessToken) {
        setStep('payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStep('success');
    setLoading(false);
    
    setTimeout(() => {
      router.push('/sign-in?approved=true');
    }, 3000);
  };

  if (step === 'success') {
    return (
      <main className="container py-14">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
            <Check className="size-10 text-green-600" />
          </div>
          <h1 className="font-display text-3xl">¡Registro completado!</h1>
          <p className="mt-3 text-foreground/70">
            Tu empresa <strong>{formData.companyName}</strong> ha sido registrada con el plan <strong>{plan.name}</strong>.
          </p>
          <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-left">
            <p className="text-sm text-amber-800">
              <strong>Pendiente de aprobación:</strong> Tu cuenta está esperando ser revisada por un administrador. 
              Te notificaremos cuando tu cuenta sea activada.
            </p>
          </div>
          <div className="mt-6">
            <Button asChild>
              <Link href="/sign-in">Ir a página de ingreso</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'payment') {
    return (
      <main className="container py-14">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-display text-4xl md:text-5xl">Completar pago</h1>
          <p className="mt-2 text-foreground/60">
            Has seleccionado el plan <strong>{plan.name}</strong> - S/ {plan.price}/mes
          </p>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Card className="rounded-[34px] bg-white/85 p-8">
              <h2 className="font-display text-2xl">Resumen del plan</h2>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-foreground/10 pb-4">
                  <div>
                    <p className="font-medium text-lg">{plan.name}</p>
                    <p className="text-sm text-foreground/50">Facturación mensual</p>
                  </div>
                  <p className="font-display text-2xl">S/ {plan.price}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">Total</span>
                  <p className="font-display text-3xl">S/ {plan.price}</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-green-50 p-4">
                <p className="text-sm text-green-800">
                  <strong>30 días gratis</strong> en tu primer mes. Cancela cuando quieras.
                </p>
              </div>
            </Card>

            <Card className="rounded-[34px] bg-white/85 p-8">
              <h2 className="font-display text-2xl">Método de pago</h2>
              
              {provider === 'yape' ? (
                <div className="mt-6">
                  <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white">
                    <div className="flex items-center gap-2">
                      <Smartphone className="size-6" />
                      <span className="font-medium">Yape - BCP</span>
                    </div>
                    
                    <div className="mt-6 flex justify-center">
                      <div className="rounded-2xl bg-white p-4">
                        <QrCode className="size-32 text-purple-800" />
                      </div>
                    </div>
                    
                    <p className="mt-4 text-center text-sm text-purple-200">
                      Escanea el código QR con tu app Yape
                    </p>
                  </div>

                  <div className="mt-6 text-center">
                    <p className="text-sm text-foreground/60">O transfers a:</p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="font-display text-3xl tracking-widest">{yapeNumber}</span>
                      <button
                        onClick={handleCopyNumber}
                        className="rounded-lg bg-foreground/10 p-2 transition hover:bg-foreground/20"
                      >
                        {copied ? <Check className="size-5 text-green-600" /> : <Copy className="size-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-foreground/10 p-4">
                    <p className="text-sm text-foreground/60">
                      <strong>Instrucciones:</strong>
                    </p>
                    <ol className="mt-2 list-inside list-decimal text-sm text-foreground/60">
                      <li>Abre Yape en tu celular</li>
                      <li>Escanea el código QR o transfiere S/ {plan.price}</li>
                      <li>Envía el comprobante a soporte</li>
                      <li>Activaremos tu plan automáticamente</li>
                    </ol>
                  </div>

                  <button
                    onClick={handleSimulatePayment}
                    disabled={loading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-6 py-4 text-sm font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      'Confirmar pago (Demo)'
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-6 text-white">
                    <div className="flex items-center gap-2">
                      <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z"/>
                      </svg>
                      <span className="font-medium">MercadoPago</span>
                    </div>
                    <p className="mt-4 text-sm text-blue-200">
                      Serás redirigido a MercadoPago para completar el pago de forma segura.
                    </p>
                  </div>

                  <button
                    onClick={handleSimulatePayment}
                    disabled={loading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirigiendo...
                      </>
                    ) : (
                      'Continuar con MercadoPago'
                    )}
                  </button>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-foreground/40">
                Pago 100% seguro. Tus datos están encriptados.
              </p>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-14">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-4xl md:text-5xl">Crear cuenta</h1>
        <p className="mt-2 text-foreground/60">
          Seleccionaste el plan <strong>{plan.name}</strong> - S/ {plan.price}/mes
        </p>

        <Card className="mt-8 rounded-[34px] bg-white/85 p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">Nombre completo</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full rounded-xl border border-foreground/20 px-4 py-3 outline-none focus:border-violet-500"
                placeholder="Juan Pérez"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Nombre de tu empresa</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full rounded-xl border border-foreground/20 px-4 py-3 outline-none focus:border-violet-500"
                placeholder="Mi Tienda"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Correo electrónico</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded-xl border border-foreground/20 px-4 py-3 outline-none focus:border-violet-500"
                placeholder="juan@ejemplo.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full rounded-xl border border-foreground/20 px-4 py-3 outline-none focus:border-violet-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-sm text-violet-800">
                <strong>Resumen:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-violet-700">
                <li>• Plan: {plan.name}</li>
                <li>• Precio: S/ {plan.price}/mes</li>
                <li>• Método de pago: {provider === 'yape' ? 'Yape' : 'MercadoPago'}</li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-4"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Continuar al pago'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-foreground/50">
            Al registrarte, aceptas nuestros términos y condiciones.
          </p>
        </Card>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main className="container flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/40" />
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
