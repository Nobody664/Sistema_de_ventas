'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Check, X, Clock, Upload, Smartphone, Building2, CreditCard, DollarSign } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface CheckoutRequest {
  id: string;
  companyId: string;
  provider: string;
  amount: string;
  currency: string;
  status: string;
  proofImageBase64?: string;
  paymentDate?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  fullName?: string;
  companyName?: string;
  email?: string;
  plan: {
    id: string;
    code: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
  };
  company?: {
    id: string;
    name: string;
    email?: string;
  };
}

type AllRequest = CheckoutRequest;

const providerIcons: Record<string, typeof Smartphone> = {
  YAPE: Smartphone,
  PLIN: Smartphone,
  TRANSFER: Building2,
};

const providerColors: Record<string, string> = {
  YAPE: 'bg-green-100 text-green-700',
  PLIN: 'bg-blue-100 text-blue-700',
  TRANSFER: 'bg-gray-100 text-gray-700',
};

const statusColors: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-gray-100 text-gray-700',
};

const statusLabels: Record<string, string> = {
  SUBMITTED: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  DRAFT: 'Borrador',
};

export default function UpgradeRequestsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [selectedRequest, setSelectedRequest] = useState<AllRequest | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'checkout' | 'subscriptions'>('checkout');

  const { data: checkoutRequests, isLoading: loadingCheckout } = useQuery({
    queryKey: ['checkout-requests'],
    queryFn: async () => {
      const data = await apiFetch<CheckoutRequest[]>('/payments/checkout/requests/pending', {
        token: session?.accessToken,
      });
      return data || [];
    },
    enabled: activeTab === 'checkout',
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, type }: { requestId: string; type: 'checkout' | 'subscriptions' }) => {
      if (type === 'checkout') {
        return apiFetch(`/payments/checkout/requests/${requestId}/review`, {
          method: 'PATCH',
          token: session?.accessToken,
          body: JSON.stringify({ status: 'APPROVED', reviewNotes }),
        });
      } else {
        return apiFetch(`/subscriptions/upgrade-requests/${requestId}/review`, {
          method: 'POST',
          token: session?.accessToken,
          body: JSON.stringify({ status: 'APPROVED', reviewNotes }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['upgrade-requests'] });
      setSelectedRequest(null);
      setShowProofModal(false);
      setReviewNotes('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, type }: { requestId: string; type: 'checkout' | 'subscriptions' }) => {
      if (type === 'checkout') {
        return apiFetch(`/payments/checkout/requests/${requestId}/review`, {
          method: 'PATCH',
          token: session?.accessToken,
          body: JSON.stringify({ status: 'REJECTED', reviewNotes }),
        });
      } else {
        return apiFetch(`/subscriptions/upgrade-requests/${requestId}/review`, {
          method: 'POST',
          token: session?.accessToken,
          body: JSON.stringify({ status: 'REJECTED', reviewNotes }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['upgrade-requests'] });
      setSelectedRequest(null);
      setShowProofModal(false);
      setReviewNotes('');
    },
  });

  const handleViewProof = (request: AllRequest) => {
    setSelectedRequest(request);
    setShowProofModal(true);
  };

  const getCompanyName = (request: AllRequest) => {
    return request.company?.name || request.companyName || 'Empresa';
  };

  const getCompanyEmail = (request: AllRequest) => {
    return request.company?.email || request.email || 'Sin email';
  };

  const isLoading = activeTab === 'checkout' ? loadingCheckout : false;
  const requests = activeTab === 'checkout' ? checkoutRequests : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Solicitudes de Upgrade</h1>
          <p className="mt-1 text-foreground/50">Revisa las solicitudes de cambio de plan de los usuarios</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-foreground/10">
        <button
          onClick={() => setActiveTab('checkout')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'checkout'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-foreground/60 hover:text-foreground'
          }`}
        >
          <CreditCard className="size-4" />
          Checkout
          {checkoutRequests && checkoutRequests.length > 0 && (
            <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
              {checkoutRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === 'subscriptions'
              ? 'border-violet-500 text-violet-600'
              : 'border-transparent text-foreground/60 hover:text-foreground'
          }`}
        >
          <DollarSign className="size-4" />
          Suscripciones
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar solicitudes..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {requests.map((request) => {
            const ProviderIcon = providerIcons[request.provider] || Smartphone;
            const providerColor = providerColors[request.provider] || 'bg-gray-100 text-gray-700';
            const statusColor = statusColors[request.status] || 'bg-gray-100 text-gray-700';
            const statusLabel = statusLabels[request.status] || request.status;

            return (
              <Card key={request.id} className="rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
                      {getCompanyName(request).charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display text-xl">{getCompanyName(request)}</h3>
                      <p className="text-sm text-foreground/50">{getCompanyEmail(request)}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
                    <Clock className="size-3" />
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <div className="rounded-lg bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                    {request.plan.name}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/60">Monto:</span>
                    <span className="font-medium">S/ {request.amount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/60">Método:</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${providerColor}`}>
                      <ProviderIcon className="size-3" />
                      {request.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/60">Fecha:</span>
                    <span>{new Date(request.createdAt).toLocaleDateString('es-PE')}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  {request.proofImageBase64 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProof(request)}
                      className="flex-1 gap-1"
                    >
                      <Upload className="size-4" />
                      Ver comprobante
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <Clock className="size-16 text-foreground/20" />
          <h3 className="mt-4 font-display text-xl">No hay solicitudes pendientes</h3>
          <p className="mt-1 text-foreground/50">Las solicitudes de upgrade aparecerán aquí.</p>
        </div>
      )}

      {showProofModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[34px] bg-white p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Revisar solicitud</h2>
              <button
                onClick={() => setShowProofModal(false)}
                className="rounded-lg p-2 hover:bg-foreground/5"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-foreground/60">Empresa</p>
                <p className="font-display text-lg">{getCompanyName(selectedRequest)}</p>
                <p className="text-sm text-foreground/60">{getCompanyEmail(selectedRequest)}</p>
              </div>

              <div className="rounded-xl bg-violet-50 p-4">
                <p className="text-sm text-foreground/60">Plan solicitado</p>
                <p className="font-display text-2xl text-violet-700">{selectedRequest.plan.name}</p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-foreground/60">Monto a pagar</p>
                <p className="font-display text-3xl text-emerald-700">S/ {selectedRequest.amount}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-foreground/60">Método</p>
                  <p className="font-medium">{selectedRequest.provider}</p>
                </div>
                <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-xs text-foreground/60">Estado</p>
                  <p className="font-medium">{statusLabels[selectedRequest.status] || selectedRequest.status}</p>
                </div>
              </div>

              {selectedRequest.proofImageBase64 && (
                <div>
                  <p className="mb-2 text-sm text-foreground/60">Comprobante de pago</p>
                  <img
                    src={selectedRequest.proofImageBase64}
                    alt="Comprobante"
                    className="w-full max-h-80 object-contain rounded-xl border"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium">Notas (opcional)</label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Agregar notas sobre la revisión..."
                  className="w-full rounded-xl border border-foreground/20 p-3 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate({ requestId: selectedRequest.id, type: activeTab as 'checkout' })}
                disabled={rejectMutation.isPending}
                className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <X className="size-4" />
                {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </Button>
              <Button
                onClick={() => approveMutation.mutate({ requestId: selectedRequest.id, type: activeTab as 'checkout' })}
                disabled={approveMutation.isPending}
                className="flex-1 gap-2"
              >
                <Check className="size-4" />
                {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
