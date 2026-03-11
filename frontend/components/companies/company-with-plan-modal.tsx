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
import type { Plan } from '@/types/api';

interface CompanyWithPlanModalProps {
  plans: Plan[];
  children?: React.ReactNode;
}

export function CompanyWithPlanModal({ plans, children }: CompanyWithPlanModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || null,
      phone: formData.get('phone') as string || null,
      timezone: 'America/Lima',
      currency: 'PEN',
      planId: formData.get('planId') as string,
    };

    try {
      await apiFetch('/companies/with-plan', {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
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
          <DialogTitle>Nueva empresa con plan</DialogTitle>
          <DialogDescription>
            Registra una nueva empresa y asígnale un plan. La empresa quedará pendiente de aprobación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la empresa *</Label>
              <Input id="name" name="name" required placeholder="Mi Empresa SAC" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="contacto@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" name="phone" placeholder="+51 900 000 000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planId">Plan *</Label>
              <select
                id="planId"
                name="planId"
                required
                className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                <option value="">Seleccionar plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - S/{plan.priceMonthly}/mes
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear empresa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
