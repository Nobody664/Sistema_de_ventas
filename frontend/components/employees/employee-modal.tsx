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
  validateTextOnly,
  formatPhone,
  PERU_VALIDATIONS 
} from '@/lib/validations';
import type { Employee } from '@/types/api';

interface EmployeeModalProps {
  employee?: Employee | null;
  children?: React.ReactNode;
}

export function EmployeeModal({ employee, children }: EmployeeModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEdit = !!employee;

  const validateForm = (formData: FormData): boolean => {
    const newErrors: Record<string, string> = {};
    
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const formatted = formatPhone(input.value);
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

    const data: Record<string, unknown> = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName') || null,
      email: formData.get('email') || null,
      phone: formData.get('phone') || null,
      role: formData.get('role'),
    };

    if (isEdit) {
      data.isActive = formData.get('isActive') === 'on';
    }

    try {
      const url = isEdit ? `/employees/${employee.id}` : '/employees';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['employees'] });
      router.refresh();
      addToast(isEdit ? 'Empleado actualizado correctamente' : 'Empleado creado correctamente', 'success');
      setOpen(false);
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Error desconocido' });
      addToast(err instanceof Error ? err.message : 'Error al guardar empleado', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos del empleado' : 'Completa los datos para registrar un nuevo empleado'}
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
                  defaultValue={employee?.firstName} 
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
                  defaultValue={employee?.lastName || ''} 
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
                  defaultValue={employee?.email || ''} 
                  placeholder="juan@empresa.com"
                  maxLength={255}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  defaultValue={employee?.phone || ''} 
                  placeholder="+51 900 000 000"
                  maxLength={15}
                  onChange={handlePhoneChange}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <select
                id="role"
                name="role"
                required
                defaultValue={employee?.role || 'STAFF'}
                className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
              >
                <option value="COMPANY_ADMIN">Administrador</option>
                <option value="MANAGER">Gerente</option>
                <option value="CASHIER">Cajero</option>
                <option value="STAFF">Personal</option>
              </select>
            </div>
            {isEdit && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  defaultChecked={employee?.isActive ?? true}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isActive" className="font-normal">
                  Empleado activo
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear empleado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
