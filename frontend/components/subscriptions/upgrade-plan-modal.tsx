'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Crown, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export function UpgradePlanModal({ plans, currentPlanCode }: UpgradePlanModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    try {
      await apiFetch(`/subscriptions/upgrade`, {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify({ planCode: selectedPlan }),
      });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error upgrading plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const planColors: Record<string, string> = {
    START: 'from-amber-500 to-amber-600',
    GROWTH: 'from-violet-500 to-violet-600',
    SCALE: 'from-indigo-500 to-indigo-600',
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Crown className="size-4" />
        Cambiar plan
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[34px] bg-white p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl">Cambiar plan</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 hover:bg-foreground/5"
              >
                ×
              </button>
            </div>
            
            <p className="mt-2 text-foreground/60">
              Selecciona el plan al que deseas actualizar. El cambio será efectivo inmediatamente.
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
                  El nuevo precio se aplicará a tu próxima facturación.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpgrade}
                disabled={!selectedPlan || loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar cambio'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
