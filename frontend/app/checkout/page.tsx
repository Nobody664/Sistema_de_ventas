'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, Loader2, Smartphone, Building2, Upload, Home, ArrowLeft, CreditCard, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

const plans = {
  FREE: { name: 'Free', price: 0, priceYearly: 0 },
  START: { name: 'Start', price: 19, priceYearly: 190 },
  GROWTH: { name: 'Growth', price: 59, priceYearly: 590 },
  SCALE: { name: 'Scale', price: 149, priceYearly: 1490 },
};

interface PaymentSettings {
  provider: string;
  isEnabled: boolean;
  qrImageBase64?: string;
  accountNumber?: string;
  accountName?: string;
  instructions?: string;
}

const paymentMethods = [
  { id: 'YAPE', name: 'Yape', icon: Smartphone, color: 'bg-green-500' },
  { id: 'PLIN', name: 'Plin', icon: Smartphone, color: 'bg-blue-500' },
  { id: 'TRANSFER', name: 'Transferencia', icon: Building2, color: 'bg-gray-500' },
];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const planCode = searchParams.get('plan') || 'START';
  const isUpgrade = searchParams.get('upgrade') === 'true';
  const plan = plans[planCode as keyof typeof plans] || plans.START;
  
  const [step, setStep] = useState<'summary' | 'payment' | 'success'>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [enabledPayments, setEnabledPayments] = useState<string[]>([]);
  
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthenticated = !!session?.user?.companyId;
  const accessToken = session?.accessToken;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/checkout?plan=' + planCode + '&upgrade=true');
    }
  }, [status, router, planCode]);

  useEffect(() => {
    fetchPaymentSettings();
  }, []);

  const fetchPaymentSettings = async () => {
    try {
      const data = await apiFetch<PaymentSettings[]>('/payments/settings/all');
      setPaymentSettings(data || []);
      const enabled = (data || [])
        .filter((p: PaymentSettings) => p.isEnabled)
        .map((p: PaymentSettings) => p.provider);
      setEnabledPayments(enabled);
      if (enabled.length > 0) {
        setSelectedPayment(enabled[0]);
      }
    } catch (err) {
      console.error('Error fetching payment settings:', err);
    }
  };

  const getPaymentSettings = (provider: string) => {
    return paymentSettings.find(p => p.provider === provider);
  };

  const handleContinueToPayment = async () => {
    if (!selectedPayment) {
      setError('Selecciona un método de pago');
      return;
    }
    setError(null);
    setStep('payment');
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = async () => {
    if (!proofImage) {
      setError('Sube el comprobante de pago');
      return;
    }

    setUploadingProof(true);
    setError(null);

    try {
      const response = await apiFetch<{ requestId: string; status: string }>('/payments/checkout/requests', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          planCode,
          paymentMethod: selectedPayment,
          companyId: session?.user?.companyId,
        }),
      });

      await apiFetch(`/payments/checkout/requests/${response.requestId}/proof`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          imageBase64: proofImage,
        }),
      });

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
    } finally {
      setUploadingProof(false);
    }
  };

  if (status === 'loading') {
    return (
      <main className="container flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground/40" />
      </main>
    );
  }

  if (step === 'success') {
    return (
      <main className="container py-14">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
            <Check className="size-10 text-green-600" />
          </div>
          <h1 className="font-display text-3xl">¡Pago recibido!</h1>
          <p className="mt-3 text-foreground/70">
            Tu solicitud para el plan <strong>{plan.name}</strong> ha sido recibida correctamente.
          </p>
          <div className="mt-8 rounded-2xl bg-blue-50 p-4 text-left">
            <p className="text-sm text-blue-800">
              <strong>Próximos pasos:</strong>
            </p>
            <ul className="mt-2 list-inside list-decimal text-sm text-blue-700">
              <li>Recibirás un correo de confirmación</li>
              <li>Tu cuenta será activada en <strong>7 días hábiles</strong></li>
              <li>Te notificaremos cuando tu cuenta esté lista</li>
            </ul>
          </div>
          <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-left">
            <p className="text-sm text-amber-800">
              <strong>Período de prueba:</strong> Una vez activada, tendrás 7 días gratis para probar el sistema.
            </p>
          </div>
          <div className="mt-6">
            <Button onClick={() => router.push('/')} className="gap-2">
              <Home className="h-4 w-4" />
              Volver al inicio
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'payment') {
    const currentPaymentSettings = selectedPayment ? getPaymentSettings(selectedPayment) : null;
    
    return (
      <main className="container py-14">
        <div className="mx-auto max-w-lg">
          <button 
            onClick={() => setStep('summary')}
            className="mb-4 flex items-center text-sm text-foreground/60 hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </button>
          
          <h1 className="font-display text-3xl">Completa tu pago</h1>
          <p className="mt-2 text-foreground/60">
            Plan <strong>{plan.name}</strong> - S/ {plan.price}/mes
          </p>
          
          <div className="mt-8 space-y-6">
            {currentPaymentSettings && (
              <Card className="rounded-2xl bg-white p-6">
                <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Datos de pago - {selectedPayment}
                </h3>
                
                {currentPaymentSettings.qrImageBase64 && (
                  <div className="mb-4">
                    <p className="text-sm text-foreground/60 mb-2">Escanea el código QR:</p>
                    <div className="flex justify-center">
                      <img 
                        src={currentPaymentSettings.qrImageBase64} 
                        alt="QR Code" 
                        className="w-48 h-48 object-contain border rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {currentPaymentSettings.accountNumber && (
                  <div className="space-y-2 text-sm">
                    <p><strong>Número:</strong> {currentPaymentSettings.accountNumber}</p>
                    {currentPaymentSettings.accountName && (
                      <p><strong>Titular:</strong> {currentPaymentSettings.accountName}</p>
                    )}
                  </div>
                )}

                {currentPaymentSettings.instructions && (
                  <div className="mt-4 p-3 bg-foreground/5 rounded-lg">
                    <p className="text-sm">{currentPaymentSettings.instructions}</p>
                  </div>
                )}

                <div className="mt-4 p-3 bg-violet-50 rounded-lg">
                  <p className="text-sm text-violet-700">
                    <strong>Monto a pagar:</strong> S/ {plan.price}
                  </p>
                </div>
              </Card>
            )}

            <Card className="rounded-2xl bg-white p-6">
              <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Subir comprobante de pago
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="proof-image">Captura de pantalla o foto del comprobante</Label>
                  <div className="mt-2">
                    <input
                      id="proof-image"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                    
                    {proofImage ? (
                      <div className="space-y-3">
                        <img 
                          src={proofImage} 
                          alt="Comprobante" 
                          className="w-full max-h-64 object-contain border rounded-xl"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setProofImage(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          Cambiar imagen
                        </Button>
                      </div>
                    ) : (
                      <label 
                        htmlFor="proof-image"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-foreground/20 rounded-xl cursor-pointer hover:bg-foreground/5 transition"
                      >
                        <Upload className="w-8 h-8 text-foreground/40" />
                        <span className="mt-2 text-sm text-foreground/60">Haz clic para subir</span>
                      </label>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={handleSubmitPayment}
                  disabled={uploadingProof || !proofImage}
                >
                  {uploadingProof ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Actualizar cuenta
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container py-14">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-4xl md:text-5xl">
          {isUpgrade ? 'Mejorar plan' : 'Crear cuenta'}
        </h1>
        <p className="mt-2 text-foreground/60">
          {isUpgrade 
            ? `Upgrade al plan ${plan.name} - S/ ${plan.price}/mes`
            : `Seleccionaste el plan ${plan.name} - S/ ${plan.price}/mes`
          }
        </p>

        <Card className="mt-8 rounded-[34px] bg-white/85 p-8">
          {isAuthenticated && (
            <div className="mb-6 rounded-xl bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Cuenta verificada</p>
                  <p className="text-sm text-green-600">Plan actual: {session?.user?.planCode || 'Trial'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="rounded-xl bg-violet-50 p-4">
              <p className="text-sm text-violet-800">
                <strong>Resumen del plan:</strong>
              </p>
              <ul className="mt-2 space-y-1 text-sm text-violet-700">
                <li>• Plan: {plan.name}</li>
                <li>• Precio: S/ {plan.price}/mes</li>
                <li>• Facturación: Mensual</li>
              </ul>
            </div>

            <div>
              <Label className="mb-3 block">Método de pago</Label>
              <div className="grid grid-cols-3 gap-3">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isEnabled = enabledPayments.includes(method.id);
                  const isSelected = selectedPayment === method.id;
                  
                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={!isEnabled}
                      onClick={() => setSelectedPayment(method.id)}
                      className={`
                        flex flex-col items-center justify-center rounded-xl border-2 p-4 transition
                        ${isSelected 
                          ? 'border-violet-500 bg-violet-50' 
                          : isEnabled 
                            ? 'border-foreground/10 hover:border-foreground/30' 
                            : 'border-foreground/5 bg-gray-50 opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <div className={`rounded-full p-2 ${method.color}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <span className="mt-2 text-sm font-medium">{method.name}</span>
                      {!isEnabled && <span className="text-xs text-red-500 mt-1">No disponible</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button
              type="button"
              onClick={handleContinueToPayment}
              disabled={loading || !selectedPayment}
              className="w-full rounded-xl py-4"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Continuar con el pago
                </>
              )}
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-foreground/50">
            <Lock className="mr-1 inline h-3 w-3" />
            Tus datos están seguros
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
