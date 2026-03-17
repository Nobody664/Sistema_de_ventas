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
import { 
  validatePhone, 
  validateEmail, 
  validateDNI, 
  validateRUC,
  validateTextOnly,
  formatPhone,
  formatDNI,
  PERU_VALIDATIONS 
} from '@/lib/validations';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!customer;

  const validateForm = (formData: FormData): boolean => {
    const newErrors: Record<string, string> = {};
    
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const documentType = formData.get('documentType') as string;
    const documentValue = formData.get('documentValue') as string;

    if (!firstName || firstName.trim().length < 2) {
      newErrors.firstName = 'El nombre debe tener al menos 2 caracteres';
    } else if (!validateTextOnly(firstName)) {
      newErrors.firstName = 'Solo se permiten letras';
    }

    if (lastName && !validateTextOnly(lastName)) {
      newErrors.lastName = 'Solo se permiten letras';
    }

    if (email && !validateEmail(email)) {
      newErrors.email = PERU_VALIDATIONS.email.error;
    }

    if (phone && !validatePhone(phone)) {
      newErrors.phone = PERU_VALIDATIONS.phone.error;
    }

    if (documentType === 'DNI' && documentValue && !validateDNI(documentValue)) {
      newErrors.documentValue = PERU_VALIDATIONS.dni.error;
    } else if (documentType === 'RUC' && documentValue && !validateRUC(documentValue)) {
      newErrors.documentValue = PERU_VALIDATIONS.ruc.error;
    } else if (documentType === 'CE' && documentValue && documentValue.length < 8) {
      newErrors.documentValue = 'El carnet de extranjeria debe tener al menos 8 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const formatted = formatPhone(input.value);
    input.value = formatted;
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const formatted = formatDNI(input.value);
    input.value = formatted;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);

    if (!validateForm(formData)) {
      setLoading(false);
      return;
    }

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
      setErrors({ general: err instanceof Error ? err.message : 'Error desconocido' });
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
            {errors.general && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{errors.general}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombres *</Label>
                <Input 
                  id="firstName" 
                  name="firstName" 
                  required 
                  defaultValue={customer?.firstName} 
                  placeholder="Juan"
                  maxLength={100}
                />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos</Label>
                <Input 
                  id="lastName" 
                  name="lastName" 
                  defaultValue={customer?.lastName || ''} 
                  placeholder="Perez"
                  maxLength={100}
                />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  defaultValue={customer?.email || ''} 
                  placeholder="juan@ejemplo.com"
                  maxLength={255}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  defaultValue={customer?.phone || ''} 
                  placeholder="+51 900 000 000"
                  maxLength={15}
                  onChange={handlePhoneChange}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
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
                <Input 
                  id="documentValue" 
                  name="documentValue" 
                  defaultValue={customer?.documentValue || ''} 
                  placeholder="12345678"
                  maxLength={11}
                  onChange={handleDocumentChange}
                />
                {errors.documentValue && <p className="text-xs text-red-500">{errors.documentValue}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input 
                id="notes" 
                name="notes" 
                defaultValue={customer?.notes || ''} 
                placeholder="Notas adicionales..."
                maxLength={500}
              />
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
