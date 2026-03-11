'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import type { Customer } from '@/types/api';

interface CustomerModalProps {
  customer?: Customer | null;
  children?: React.ReactNode;
}

export function CustomerModal({ customer, children }: CustomerModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!customer;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName') || null,
      email: formData.get('email') || null,
      phone: formData.get('phone') || null,
      documentType: formData.get('documentType') || null,
      documentValue: formData.get('documentValue') || null,
      notes: formData.get('notes') || null,
    };

    try {
      const url = isEdit ? `/customers/${customer.id}` : '/customers';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.refresh();
      addToast(isEdit ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente', 'success');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      addToast(err instanceof Error ? err.message : 'Error al guardar cliente', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos del cliente' : 'Completa los datos para registrar un nuevo cliente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombres *</Label>
                <Input id="firstName" name="firstName" required defaultValue={customer?.firstName} placeholder="Juan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos</Label>
                <Input id="lastName" name="lastName" defaultValue={customer?.lastName || ''} placeholder="Perez" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={customer?.email || ''} placeholder="juan@ejemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input id="phone" name="phone" defaultValue={customer?.phone || ''} placeholder="+51 900 000 000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="documentType">Tipo documento</Label>
                <select
                  id="documentType"
                  name="documentType"
                  defaultValue={customer?.documentType || ''}
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <option value="">Seleccionar</option>
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">Carnet de Extranjeria</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentValue">Numero documento</Label>
                <Input id="documentValue" name="documentValue" defaultValue={customer?.documentValue || ''} placeholder="12345678" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" defaultValue={customer?.notes || ''} placeholder="Notas adicionales..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
