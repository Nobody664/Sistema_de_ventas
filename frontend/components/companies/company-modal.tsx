'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
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
import type { Company } from '@/types/api';

interface CompanyModalProps {
  company?: Company | null;
  children?: React.ReactNode;
}

export function CompanyModal({ company, children }: CompanyModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!company;

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const data = {
      name,
      slug: isEdit ? company?.slug : generateSlug(name),
      email: formData.get('email') || null,
      phone: formData.get('phone') || null,
      timezone: formData.get('timezone') || 'America/Lima',
      currency: formData.get('currency') || 'PEN',
    };

    try {
      const url = isEdit ? `/companies/${company.id}` : '/companies';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos de la empresa' : 'Completa los datos para registrar una nueva empresa'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la empresa *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={company?.name}
                placeholder="Mi Empresa SAC"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={company?.email || ''}
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={company?.phone || ''}
                  placeholder="+51 900 000 000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Moneda</Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={company?.currency || 'PEN'}
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                  <option value="EUR">Euros (EUR)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona horaria</Label>
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue={company?.timezone || 'America/Lima'}
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <option value="America/Lima">Lima (UTC-5)</option>
                  <option value="America/Bogota">Bogotá (UTC-5)</option>
                  <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
                  <option value="America/New_York">Nueva York (UTC-5)</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear empresa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
