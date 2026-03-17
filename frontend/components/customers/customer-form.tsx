'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, User, Mail, Phone, MapPin, FileText, AlertTriangle, ArrowLeft, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { useUiStore } from '@/store/ui-store';
import { createCustomerSchema } from '@/lib/validations/customer.validation';
import type { Customer } from '@/types/api';
import { DniSearch } from '@/components/ui/dni-search';

interface CustomerFormProps {
  customer?: Customer | null;
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [documentType, setDocumentType] = useState<string>(
    (customer?.documentType === 'DNI' || customer?.documentType === 'RUC' || customer?.documentType === 'PASSPORT') 
      ? customer.documentType 
      : 'DNI'
  );

  const isEdit = !!customer;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    
    const data = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: (formData.get('email') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      documentType: documentType,
      documentNumber: formData.get('documentNumber') as string,
      notes: (formData.get('notes') as string) || undefined,
    };

    const payload = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      documentType: data.documentType,
      documentValue: data.documentNumber,
      notes: data.notes,
    };

    const result = createCustomerSchema.safeParse(data);

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
      const url = isEdit ? `/customers/${customer.id}` : '/customers';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(payload),
      });

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      addToast(isEdit ? 'Cliente actualizado correctamente' : 'Cliente creado correctamente', 'success');
      router.push('/customers');
    } catch (err: unknown) {
      const { message, isLimitError } = handleLimitError(err);
      setError(message);
      addToast(message, isLimitError ? 'info' : 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDniResult = (data: { firstName: string; lastName: string; phone?: string; address?: string }) => {
    const firstNameInput = document.getElementById('firstName') as HTMLInputElement;
    const lastNameInput = document.getElementById('lastName') as HTMLInputElement;
    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    
    if (firstNameInput) firstNameInput.value = data.firstName;
    if (lastNameInput) lastNameInput.value = data.lastName;
    if (phoneInput && data.phone) phoneInput.value = data.phone;
  };

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/customers')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 shadow-lg shadow-blue-500/20">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-400"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isEdit ? 'Actualiza la información del cliente' : 'Completa los datos para registrar un nuevo cliente'}
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
              {/* Document - Búsqueda al inicio */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documento de identidad
                </p>
                
                {documentType === 'PASSPORT' ? (
                  <div className="space-y-2">
                    <Label htmlFor="documentNumber" className="text-sm font-semibold text-slate-700">
                      Número de documento *
                    </Label>
                    <Input 
                      id="documentNumber" 
                      name="documentNumber"
                      defaultValue={customer?.documentValue || ''}
                      placeholder="AB1234567"
                      className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.documentNumber ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.documentNumber && (
                      <p className="text-sm text-red-500">{fieldErrors.documentNumber}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="documentType" className="text-sm font-semibold text-slate-700">
                        Tipo de documento
                      </Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDocumentType('DNI')}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                            documentType === 'DNI'
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          DNI
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocumentType('RUC')}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                            documentType === 'RUC'
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          RUC
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocumentType('PASSPORT')}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                            documentType === 'PASSPORT'
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Pasaporte
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">
                        Buscar por {documentType}
                      </Label>
                      {documentType !== 'PASSPORT' && (
                        <DniSearch 
                          documentType={documentType} 
                          onResult={handleDniResult}
                        />
                      )}
                      {documentType === 'PASSPORT' && (
                        <p className="text-sm text-slate-500">Ingrese el número de pasaporte manualmente</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="documentNumber" className="text-sm font-semibold text-slate-700">
                        Número de documento {documentType === 'PASSPORT' && '*'}
                      </Label>
                      <Input 
                        id="documentNumber" 
                        name="documentNumber"
                        defaultValue={customer?.documentValue || ''}
                        placeholder={documentType === 'DNI' ? '12345678' : '20123456789'}
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.documentNumber ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.documentNumber && (
                        <p className="text-sm text-red-500">{fieldErrors.documentNumber}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                      defaultValue={customer?.firstName || ''}
                      placeholder="Juan"
                      className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.firstName ? 'border-red-500' : ''}`}
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
                      defaultValue={customer?.lastName || ''}
                      placeholder="Perez"
                      className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.lastName && (
                      <p className="text-sm text-red-500">{fieldErrors.lastName}</p>
                    )}
                  </div>
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
                      Correo electrónico
                    </Label>
                    <div className="relative">
                      <Input 
                        id="email" 
                        name="email"
                        type="email"
                        defaultValue={customer?.email || ''}
                        placeholder="juan@ejemplo.com"
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.email ? 'border-red-500' : ''}`}
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
                        defaultValue={customer?.phone || ''}
                        placeholder="+51 999 999 999"
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${fieldErrors.phone ? 'border-red-500' : ''}`}
                      />
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    </div>
                    {fieldErrors.phone && (
                      <p className="text-sm text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Notas
                </p>
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-semibold text-slate-700">
                    Observaciones
                  </Label>
                  <textarea
                    id="notes" 
                    name="notes"
                    defaultValue={customer?.notes || ''}
                    placeholder="Notas adicionales sobre el cliente..."
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  />
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
                onClick={() => router.push('/customers')} 
                className="h-12 rounded-xl px-6 border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 font-semibold hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear cliente'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
