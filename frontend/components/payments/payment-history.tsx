'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, CheckCircle, Clock, AlertCircle, XCircle, DollarSign, Shield, Upload, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { compressImage } from '@/lib/image-compression';
import { useRouter } from 'next/navigation';

interface BillingStatus {
  subscription: {
    id: string;
    status: string;
    plan: { id: string; name: string; code: string; priceMonthly: string };
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    billingCycle: string;
  };
  currentPending: {
    id: string;
    amount: string;
    dueDate: string;
    status: string;
    hasProof: boolean;
  } | null;
  lastPayment: {
    id: string;
    amount: string;
    paidAt: string;
    status: string;
  } | null;
  recentPayments: Array<{
    id: string;
    amount: string;
    status: string;
    dueDate: string;
    paidAt: string;
    createdAt: string;
    hasProof: boolean;
    proofStatus: string;
  }>;
}

interface PaymentHistoryClientProps {
  billingStatus: BillingStatus | null;
  pendingPayments: unknown;
  paymentHistory: unknown;
  isSuperAdmin: boolean;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; icon: typeof Clock; label: string }> = {
    SUCCEEDED: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, label: 'Pagado' },
    PENDING: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, label: 'Pendiente' },
    FAILED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle, label: 'Falló' },
    REFUNDED: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Reembolsado' },
    CANCELED: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: XCircle, label: 'Cancelado' },
  };
  const c = config[status] || config.PENDING;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.bg} ${c.color}`}>
      <Icon className="size-3.5" />
      {c.label}
    </span>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    TRIALING: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Prueba' },
    ACTIVE: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Activa' },
    PAST_DUE: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Vencida' },
    CANCELED: { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', label: 'Cancelada' },
    EXPIRED: { color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', label: 'Expirada' },
  };
  const c = config[status] || { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

export function PaymentHistoryClient({ billingStatus, isSuperAdmin }: PaymentHistoryClientProps) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!billingStatus) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <CreditCard className="mx-auto size-12 text-foreground/30" />
          <h2 className="mt-4 font-display text-2xl">Sin suscripción activa</h2>
          <p className="mt-2 text-foreground/50">No tienes una suscripción activa actualmente.</p>
        </div>
      </div>
    );
  }

  const { subscription, currentPending, recentPayments } = billingStatus;

  const handleImageUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      setProofImage(compressed);
    } catch {
      setMessage({ type: 'error', text: 'Error al procesar la imagen' });
    }
  };

  const handleSubmitProof = async () => {
    if (!proofImage || !currentPending) return;
    setUploading(true);
    try {
      await apiFetch(`/payments/${currentPending.id}/proof`, {
        method: 'POST',
        body: JSON.stringify({ imageBase64: proofImage }),
      });
      setUploaded(true);
      setMessage({ type: 'success', text: 'Comprobante subido correctamente. Recibirás una confirmación cuando sea revisado.' });
      setTimeout(() => router.refresh(), 2000);
    } catch {
      setMessage({ type: 'error', text: 'Error al subir el comprobante. Intenta nuevamente.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-3 text-white">
          <DollarSign className="size-8" />
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/40">Finanzas</p>
          <h1 className="mt-1 font-display text-4xl">Mis Pagos</h1>
          <p className="mt-1 text-foreground/50">Historial y estado de tu suscripción</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-[30px] bg-white/85 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl">Plan Actual</h2>
              <p className="text-foreground/50">{subscription.plan.name}</p>
            </div>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-foreground/50">Monto mensual</p>
              <p className="mt-1 font-display text-2xl">S/ {subscription.plan.priceMonthly}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-foreground/50">Ciclo</p>
              <p className="mt-1 font-display text-lg">{subscription.billingCycle === 'MONTHLY' ? 'Mensual' : 'Anual'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-foreground/50">Inicio</p>
              <p className="mt-1 font-medium">{new Date(subscription.startDate).toLocaleDateString('es-PE')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-foreground/50">Próximo vencimiento</p>
              <p className="mt-1 font-medium">{new Date(subscription.endDate).toLocaleDateString('es-PE')}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/85 p-6">
          <h2 className="font-display text-lg">Estado de Pago</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-foreground/60">Estado</span>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-foreground/60">Renovación</span>
              <span className="text-sm font-medium">{subscription.autoRenew ? 'Automática' : 'Manual'}</span>
            </div>
            {currentPending && (
              <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3">
                <span className="text-sm text-amber-700">Pago pendiente</span>
                <span className="text-sm font-medium text-amber-700">S/ {currentPending.amount}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {currentPending && !currentPending.hasProof && (
        <Card className="rounded-[30px] bg-amber-50 border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-100 p-2">
              <AlertCircle className="size-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg text-amber-800">Pago Pendiente</h3>
              <p className="text-sm text-amber-700 mt-1">
                Tienes un pago pendiente de <strong>S/ {currentPending.amount}</strong>
                {currentPending.dueDate && (
                  <> con vencimiento el <strong>{new Date(currentPending.dueDate).toLocaleDateString('es-PE')}</strong></>
                )}.
                Sube tu comprobante de pago para mantener tu suscripción activa.
              </p>

              {!showUpload && (
                <Button onClick={() => setShowUpload(true)} className="mt-4" variant="default">
                  <Upload className="mr-2 size-4" />
                  Subir comprobante de pago
                </Button>
              )}

              {showUpload && (
                <div className="mt-4 space-y-4">
                  {!uploaded && (
                    <>
                      <div className="flex items-center gap-4">
                        {proofImage ? (
                          <div className="space-y-3">
                            <img src={proofImage} alt="Comprobante" className="max-h-48 rounded-xl border object-contain" />
                            <Button variant="outline" size="sm" onClick={() => { setProofImage(null); setUploaded(false); }}>
                              Cambiar imagen
                            </Button>
                          </div>
                        ) : (
                          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-6 py-8 transition hover:bg-amber-100/50">
                            <Upload className="size-8 text-amber-400" />
                            <span className="mt-2 text-sm text-amber-600">Haz clic para subir tu comprobante</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                          </label>
                        )}
                      </div>

                      {message && (
                        <div className={`flex items-center gap-2 rounded-lg p-3 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {message.type === 'success' ? <Check className="size-4" /> : <AlertCircle className="size-4" />}
                          <span className="text-sm">{message.text}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button onClick={handleSubmitProof} disabled={!proofImage || uploading}>
                          {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                          Confirmar pago
                        </Button>
                        <Button variant="outline" onClick={() => setShowUpload(false)}>
                          Cancelar
                        </Button>
                      </div>

                      <div className="rounded-xl bg-blue-50 p-4">
                        <div className="flex items-start gap-2">
                          <Shield className="mt-0.5 size-4 text-blue-600 shrink-0" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium">Instrucciones:</p>
                            <ol className="mt-1 list-inside list-decimal space-y-1">
                              <li>Realiza el pago de S/ {currentPending.amount} por Yape, Plin o Transferencia</li>
                              <li>Toma una captura de pantalla del comprobante</li>
                              <li>Súbela aquí para que nuestro equipo la verifique</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {uploaded && (
                    <div className="rounded-xl bg-green-100 p-4 text-green-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="size-5" />
                        <p className="font-medium">Comprobante subido exitosamente</p>
                      </div>
                      <p className="mt-1 text-sm">Recibirás una notificación cuando sea revisado.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="rounded-[30px] bg-white/85 p-6">
        <h2 className="font-display text-xl">Historial de Pagos</h2>
        <p className="mt-1 text-foreground/50">Últimos pagos registrados</p>

        <div className="mt-6 space-y-3">
          {recentPayments.length > 0 ? (
            recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-2 ${
                    payment.status === 'SUCCEEDED' ? 'bg-green-100' :
                    payment.status === 'PENDING' ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    {payment.status === 'SUCCEEDED' ? (
                      <CheckCircle className="size-5 text-green-700" />
                    ) : payment.status === 'PENDING' ? (
                      <Clock className="size-5 text-amber-700" />
                    ) : (
                      <XCircle className="size-5 text-red-700" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">S/ {payment.amount}</p>
                    <p className="text-xs text-foreground/50">
                      {payment.dueDate ? `Vence: ${new Date(payment.dueDate).toLocaleDateString('es-PE')}` : 
                       payment.paidAt ? `Pagado: ${new Date(payment.paidAt).toLocaleDateString('es-PE')}` : 
                       `Creado: ${new Date(payment.createdAt).toLocaleDateString('es-PE')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {payment.hasProof && (
                    <span className="text-xs text-foreground/50">
                      {payment.proofStatus === 'APPROVED' ? '✓ Verificado' :
                       payment.proofStatus === 'REJECTED' ? '✗ Rechazado' : 'En revisión'}
                    </span>
                  )}
                  <PaymentStatusBadge status={payment.status} />
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center">
              <DollarSign className="mx-auto size-10 text-foreground/20" />
              <p className="mt-2 text-foreground/50">No hay pagos registrados aún</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
