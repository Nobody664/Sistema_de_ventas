'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Handshake, Loader2, Mail, MapPin, Phone, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, getAccessToken } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import type { Distributor } from '@/types/distributors';

interface DistributorFormProps {
  distributor?: Distributor | null;
}

export function DistributorForm({ distributor }: DistributorFormProps) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!distributor;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      code: (formData.get('code') as string)?.trim(),
      name: (formData.get('name') as string)?.trim(),
      type: formData.get('type') as string,
      documentType: (formData.get('documentType') as string) || undefined,
      documentValue: (formData.get('documentValue') as string) || undefined,
      email: (formData.get('email') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      address: (formData.get('address') as string) || undefined,
      notes: (formData.get('notes') as string) || undefined,
    };

    const commission = formData.get('commissionRate') as string;
    if (commission) {
      payload.commissionRate = Number(commission);
    }

    if (isEdit) {
      const status = formData.get('status') as string;
      if (status) payload.status = status;
    }

    if (!payload.code || !payload.name) {
      setError('El código y el nombre son obligatorios.');
      setLoading(false);
      return;
    }

    try {
      if (isEdit) {
        await apiFetch(`/distributors/${distributor!.id}`, {
          method: 'PATCH',
          token: getAccessToken(),
          body: JSON.stringify(payload),
        });
        addToast('Distribuidor actualizado correctamente', 'success');
      } else {
        await apiFetch('/distributors', {
          method: 'POST',
          token: getAccessToken(),
          body: JSON.stringify(payload),
        });
        addToast('Distribuidor creado correctamente', 'success');
      }
      router.push('/distributors');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <button
        onClick={() => router.push('/distributors')}
        className="flex items-center gap-2 text-sm text-foreground/50 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a distribuidores
      </button>

      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-3 shadow-lg shadow-orange-500/20">
          <Handshake className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            {isEdit ? 'Editar distribuidor' : 'Nuevo distribuidor'}
          </h1>
          <p className="text-sm text-foreground/50">
            {isEdit ? 'Actualiza los datos del distribuidor' : 'Registra un distribuidor para tu empresa'}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div className="rounded-2xl border border-foreground/10 bg-card p-6 md:p-8">
          <div className="space-y-8">
            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/40">
                <FileText className="h-4 w-4" />
                Identificación
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-semibold">Código *</Label>
                  <Input
                    id="code"
                    name="code"
                    defaultValue={distributor?.code ?? ''}
                    placeholder="DIST-001"
                    maxLength={40}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">Nombre / Razón social *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={distributor?.name ?? ''}
                    placeholder="Distribuidora del Norte"
                    maxLength={160}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-semibold">Tipo</Label>
                  <select
                    id="type"
                    name="type"
                    defaultValue={distributor?.type ?? 'INDIVIDUAL'}
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="INDIVIDUAL">Persona natural</option>
                    <option value="COMPANY">Empresa</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentValue" className="text-sm font-semibold">Documento</Label>
                  <Input
                    id="documentValue"
                    name="documentValue"
                    defaultValue={distributor?.documentValue ?? ''}
                    placeholder="DNI / RUC"
                    maxLength={30}
                    className="h-12 rounded-xl"
                  />
                </div>
                {isEdit && (
                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-semibold">Estado</Label>
                    <select
                      id="status"
                      name="status"
                      defaultValue={distributor?.status ?? 'ACTIVE'}
                      className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="SUSPENDED">Suspendido</option>
                      <option value="BLOCKED">Bloqueado</option>
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="commissionRate" className="text-sm font-semibold">Comisión (%)</Label>
                  <Input
                    id="commissionRate"
                    name="commissionRate"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={distributor?.commissionRate ?? ''}
                    placeholder="5"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/40">
                <Mail className="h-4 w-4" />
                Contacto
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Correo electrónico</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={distributor?.email ?? ''}
                    placeholder="contacto@distribuidora.com"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold">Teléfono</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={distributor?.phone ?? ''}
                      placeholder="+51 999 999 999"
                      className="h-12 rounded-xl pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="text-sm font-semibold">Dirección</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                    <Input
                      id="address"
                      name="address"
                      defaultValue={distributor?.address ?? ''}
                      placeholder="Av. Principal 123"
                      className="h-12 rounded-xl pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/40">
                <FileText className="h-4 w-4" />
                Notas
              </p>
              <textarea
                id="notes"
                name="notes"
                defaultValue={distributor?.notes ?? ''}
                placeholder="Observaciones sobre el distribuidor..."
                rows={3}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground/40">Los campos marcados con * son obligatorios</p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => router.push('/distributors')} className="h-12 rounded-xl px-6">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-8 font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-amber-700"
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear distribuidor'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
