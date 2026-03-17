'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, User, Mail, Phone, FileText, AlertTriangle, ArrowLeft, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { useUiStore } from '@/store/ui-store';
import { createEmployeeSchema } from '@/lib/validations/employee.validation';
import type { Employee } from '@/types/api';

interface EmployeeFormProps {
  employee?: Employee | null;
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = !!employee;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || undefined,
      dni: formData.get('dni') as string,
      role: (formData.get('role') as 'MANAGER' | 'CASHIER' | 'SUPPORT') || 'CASHIER',
      isActive: formData.get('isActive') === 'on',
    };

    const result = createEmployeeSchema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field) {
          errors[field as string] = issue.message;
        }
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
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
      addToast(isEdit ? 'Empleado actualizado correctamente' : 'Empleado creado correctamente', 'success');
      router.push('/employees');
    } catch (err: unknown) {
      const { message, isLimitError } = handleLimitError(err);
      setError(message);
      addToast(message, isLimitError ? 'info' : 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/employees')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a empleados
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 p-3 shadow-lg shadow-purple-500/20">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-purple-400"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Editar empleado' : 'Nuevo empleado'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isEdit ? 'Actualiza la información del empleado' : 'Completa los datos para registrar un nuevo empleado'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
            <div className="space-y-8">
              {/* Personal Info */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información personal
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold text-slate-700">
                      Nombres *
                    </Label>
                    <Input 
                      id="firstName" 
                      name="firstName"
                      defaultValue={employee?.firstName || ''}
                      placeholder="Juan"
                      className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.firstName && (
                      <p className="text-sm text-red-500">{fieldErrors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold text-slate-700">
                      Apellidos *
                    </Label>
                    <Input 
                      id="lastName" 
                      name="lastName"
                      defaultValue={employee?.lastName || ''}
                      placeholder="Perez"
                      className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.lastName && (
                      <p className="text-sm text-red-500">{fieldErrors.lastName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Document */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documento de identidad
                </p>
                <div className="space-y-2">
                  <Label htmlFor="dni" className="text-sm font-semibold text-slate-700">
                    DNI *
                  </Label>
                  <Input 
                    id="dni" 
                    name="dni"
                    defaultValue={employee?.dni || ''}
                    placeholder="12345678"
                    maxLength={8}
                    className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all ${fieldErrors.dni ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.dni && (
                    <p className="text-sm text-red-500">{fieldErrors.dni}</p>
                  )}
                  <p className="text-xs text-slate-400">El DNI debe tener 8 dígitos</p>
                </div>
              </div>

              {/* Contact */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Información de contacto
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                      Correo electrónico *
                    </Label>
                    <div className="relative">
                      <Input 
                        id="email" 
                        name="email"
                        type="email"
                        defaultValue={employee?.user?.email || employee?.email || ''}
                        placeholder="juan@empresa.com"
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all ${fieldErrors.email ? 'border-red-500' : ''}`}
                      />
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-sm text-red-500">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                      Teléfono
                    </Label>
                    <div className="relative">
                      <Input 
                        id="phone" 
                        name="phone"
                        defaultValue={employee?.phone || ''}
                        placeholder="+51 999 999 999"
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all ${fieldErrors.phone ? 'border-red-500' : ''}`}
                      />
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-sm text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Role & Status */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Rol y estado
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-sm font-semibold text-slate-700">
                      Rol del empleado
                    </Label>
                    <select
                      id="role"
                      name="role"
                      defaultValue={employee?.role || 'CASHIER'}
                      className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="MANAGER">Gerente</option>
                      <option value="CASHIER">Cajero</option>
                      <option value="SUPPORT">Soporte</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">
                      Estado
                    </Label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={employee?.isActive ?? true}
                        className="sr-only"
                      />
                      <div className="relative">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={employee?.isActive ?? true}
                          className="sr-only"
                        />
                        <div className={`h-8 w-14 rounded-full transition-colors ${employee?.isActive !== false ? 'bg-purple-500' : 'bg-slate-300'}`}>
                          <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${employee?.isActive !== false ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                      </div>
                      <span className={`text-sm font-medium ${employee?.isActive !== false ? 'text-purple-600' : 'text-slate-400'}`}>
                        {employee?.isActive !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Los campos marcados con * son obligatorios</p>
            <div className="flex items-center gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push('/employees')} 
                className="h-12 rounded-xl px-6 border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-8 font-semibold hover:from-purple-600 hover:to-violet-700 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear empleado'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
