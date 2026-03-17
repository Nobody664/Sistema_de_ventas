'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Crown, Check, Loader2, Smartphone, Building2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  features?: string[];
}

interface UpgradePlanModalProps {
  plans: Plan[];
  currentPlanCode?: string;
}

interface PaymentSettings {
  provider: string;
  isEnabled: boolean;
  qrImageBase64?: string;
  accountNumber?: string;
  accountName?: string;
  instructions?: string;
}

interface UpgradeResponse {
  requestId: string;
  status: string;
  currentPlan: { code: string; name: string };
  newPlan: { code: string; name: string; priceMonthly: string; priceYearly: string };
  paymentMethod: string;
  paymentSettings: PaymentSettings;
}

const paymentMethods = [
  { id: 'YAPE', name: 'Yape', icon: Smartphone, color: 'bg-green-500' },
  { id: 'PLIN', name: 'Plin', icon: Smartphone, color: 'bg-blue-500' },
  { id: 'TRANSFER', name: 'Transferencia', icon: Building2, color: 'bg-gray-500' },
];

export function UpgradePlanModal({ plans, currentPlanCode }: UpgradePlanModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'payment' | 'success'>('select');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings[]>([]);
  const [upgradeRequestId, setUpgradeRequestId] = useState<string | null>(null);
  const [newPlanPrice, setNewPlanPrice] = useState<string>('');
  
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [proofUploaded, setProofUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = async () => {
    setIsOpen(true);
    setStep('select');
    setSelectedPlan(null);
    setSelectedPayment(null);
    setProofImage(null);
    setProofUploaded(false);
    setUpgradeRequestId(null);
    await fetchPaymentSettings();
  };

  const fetchPaymentSettings = async () => {
    try {
      const data = await apiFetch<PaymentSettings[]>('/payments/settings', {
        token: session?.accessToken,
      });
      setPaymentSettings(data || []);
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    }
  };

  const getPaymentSettings = (provider: string) => {
    return paymentSettings.find(p => p.provider === provider);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlan || !selectedPayment) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<UpgradeResponse>('/subscriptions/upgrade-requests', {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify({
          newPlanCode: selectedPlan,
          paymentMethod: selectedPayment,
        }),
      });

      setUpgradeRequestId(data.requestId);
      setNewPlanPrice(data.newPlan.priceMonthly);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofImage || !upgradeRequestId) return;

    setLoading(true);
    try {
      await apiFetch(`/subscriptions/upgrade-requests/${upgradeRequestId}/proof`, {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify({
          imageBase64: proofImage,
        }),
      });
      
      setProofUploaded(true);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setTimeout(() => {
        setStep('success');
      }, 2000);
    } catch (err) {
      setError('Error al subir el comprobante');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    router.refresh();
  };

  const planColors: Record<string, string> = {
    START: 'from-amber-500 to-amber-600',
    GROWTH: 'from-violet-500 to-violet-600',
    SCALE: 'from-indigo-500 to-indigo-600',
  };

  const currentPaymentSettings = selectedPayment ? getPaymentSettings(selectedPayment) : null;

  if (step === 'success') {
    return (
      <>
        <Button onClick={handleOpen} className="gap-2">
          <Crown className="size-4" />
          Cambiar plan
        </Button>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[90vh] w-full max-w-md overflow-auto rounded-[34px] bg-white p-8 text-center">
              <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-green-100">
                <Check className="size-10 text-green-600" />
              </div>
              <h2 className="font-display text-2xl">¡Solicitud enviada!</h2>
              <p className="mt-3 text-foreground/70">
                Tu solicitud para cambiar al plan <strong>{plans.find(p => p.code === selectedPlan)?.name}</strong> ha sido recibida.
              </p>
              {proofUploaded && (
                <div className="mt-4 rounded-xl bg-green-50 p-4 text-left">
                  <p className="text-sm text-green-700">
                    <Check className="mr-2 inline h-4 w-4" />
                    Comprobante de pago subido correctamente.
                  </p>
                </div>
              )}
              <div className="mt-6 rounded-2xl bg-blue-50 p-4 text-left">
                <p className="text-sm text-blue-800">
                  <strong>Próximos pasos:</strong>
                </p>
                <ul className="mt-2 list-inside list-decimal text-sm text-blue-700">
                  <li>Recibirás un correo de confirmación</li>
                  <li>Tu cambio de plan será aprobado en <strong>7 días hábiles</strong></li>
                  <li>Te notificaremos cuando esté listo</li>
                </ul>
              </div>
              <Button onClick={handleClose} className="mt-6 w-full gap-2">
                Aceptar
              </Button>
            </Card>
          </div>
        )}
      </>
    );
  }

  if (step === 'payment' && upgradeRequestId) {
    return (
      <>
        <Button onClick={handleOpen} className="gap-2">
          <Crown className="size-4" />
          Cambiar plan
        </Button>

        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[34px] bg-white p-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Completa tu pago</h2>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-2 hover:bg-foreground/5"
                >
                  ×
                </button>
              </div>
              
              <p className="mt-2 text-foreground/60">
                Plan <strong>{plans.find(p => p.code === selectedPlan)?.name}</strong> - S/ {newPlanPrice}/mes
              </p>

              <div className="mt-6 space-y-6">
                {currentPaymentSettings && (
                  <Card className="rounded-2xl bg-white p-6">
                    <h3 className="font-display text-lg mb-4 flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Datos de pago
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
                        <strong>Monto a pagar:</strong> S/ {newPlanPrice}
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
                      <Label>Captura de pantalla o foto del comprobante (obligatorio)</Label>
                      <div className="mt-2">
                        <input
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
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-foreground/20 rounded-xl cursor-pointer hover:bg-foreground/5 transition">
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
                      onClick={handleSubmitProof}
                      disabled={loading || !proofImage || proofUploaded}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Subiendo...
                        </>
                      ) : proofUploaded ? (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Comprobante subido
                        </>
                      ) : (
                        'Confirmar pago'
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </Card>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Button onClick={handleOpen} className="gap-2">
        <Crown className="size-4" />
        Cambiar plan
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[34px] bg-white p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl">Cambiar plan</h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 hover:bg-foreground/5"
              >
                ×
              </button>
            </div>
            
            <p className="mt-2 text-foreground/60">
              Selecciona el plan al que deseas actualizar.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.code === currentPlanCode;
                const isSelected = selectedPlan === plan.code;
                const colorClass = planColors[plan.code] || 'from-gray-500 to-gray-600';
                
                return (
                  <button
                    key={plan.id}
                    onClick={() => !isCurrent && setSelectedPlan(plan.code)}
                    disabled={isCurrent}
                    className={`relative rounded-[24px] border-2 p-6 text-left transition ${
                      isCurrent
                        ? 'border-foreground/20 bg-foreground/5 opacity-50'
                        : isSelected
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-foreground/10 hover:border-foreground/30'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-xs text-white">
                        Actual
                      </span>
                    )}
                    
                    <p className="text-sm uppercase tracking-[0.18em] text-foreground/60">
                      {plan.name}
                    </p>
                    
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-display text-4xl">S/</span>
                      <span className="font-display text-4xl">{plan.priceMonthly}</span>
                      <span className="text-foreground/50">/mes</span>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      {plan.features?.map((feature: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedPlan && (
              <div className="mt-6 rounded-2xl bg-violet-50 p-4">
                <p className="text-sm text-violet-800">
                  Estás cambiando al plan <strong>{plans.find(p => p.code === selectedPlan)?.name}</strong>.
                </p>
              </div>
            )}

            {selectedPlan && (
              <div className="mt-6">
                <Label className="mb-3 block text-sm font-medium">Método de pago</Label>
                <div className="grid grid-cols-3 gap-3">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isEnabled = paymentSettings.some(p => p.provider === method.id && p.isEnabled);
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
            )}

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleProceedToPayment}
                disabled={!selectedPlan || !selectedPayment || loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Continuar'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
