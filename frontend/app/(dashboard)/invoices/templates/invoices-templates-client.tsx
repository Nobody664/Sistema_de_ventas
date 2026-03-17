'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, Plus, Pencil, Trash2, Eye, CheckCircle, XCircle, 
  Printer, Ticket, Receipt, ArrowRight, Sparkles,
  Building2, User, Package, CreditCard
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

interface InvoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isGlobal: boolean;
  isDefault: boolean;
  paperSize: string;
  fontFamily: string;
  fontSize: number;
  logoUrl: string | null;
  companyRuc: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  showLogo: boolean;
  showCompany: boolean;
  showCustomer: boolean;
  showEmployee: boolean;
  showItems: boolean;
  showSubtotal: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showSaleNumber: boolean;
  showSaleDate: boolean;
  showSaleTime: boolean;
  showPaymentMethod: boolean;
  footerText: string | null;
  taxPercentage: number;
}

interface InvoicesTemplatesClientProps {
  templates: InvoiceTemplate[];
  companies?: Array<{
    id: string;
    name: string;
    taxId: string | null;
    address: string | null;
    phone: string | null;
  }>;
}

const templatePresets = [
  { 
    type: 'BOLETA', 
    name: 'Boleta Estándar', 
    paperSize: 'A4', 
    description: 'Formato A4 para impresión estándar',
    color: 'from-blue-500 to-indigo-600',
    icon: FileText,
  },
  { 
    type: 'TICKET', 
    name: 'Ticket Térmico', 
    paperSize: 'thermal', 
    description: 'Formato reducido para impresoras térmicas de 58mm',
    color: 'from-orange-500 to-amber-600',
    icon: Ticket,
  },
  { 
    type: 'FACTURA', 
    name: 'Factura', 
    paperSize: 'A4', 
    description: 'Factura con datos de RUC para operaciones formales',
    color: 'from-emerald-500 to-teal-600',
    icon: Receipt,
  },
];

export function InvoicesTemplatesClient({ templates: initialTemplates, companies: initialCompanies }: InvoicesTemplatesClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  const { data: templates } = useQuery({
    queryKey: ['invoice-templates'],
    queryFn: () => apiFetch<InvoiceTemplate[]>('/invoices/templates', { token: session?.accessToken }),
    initialData: initialTemplates,
  });

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Array<{ id: string; name: string; taxId: string | null; address: string | null; phone: string | null }>>('/companies', { token: session?.accessToken }),
    initialData: initialCompanies,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/invoices/templates/${id}`, {
        method: 'DELETE',
        token: session?.accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      addToast('Plantilla eliminada correctamente', 'success');
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const getTypeConfig = (type: string) => {
    const configs: Record<string, typeof templatePresets[0]> = {};
    templatePresets.forEach(p => { configs[p.type] = p; });
    return configs[type] || templatePresets[0];
  };

  const getPaperSizeLabel = (size: string) => {
    const labels: Record<string, string> = {
      A4: 'A4',
      A5: 'A5',
      thermal: 'Thermal 58mm',
    };
    return labels[size] || size;
  };

  const getTemplateCount = (type: string) => {
    return templates?.filter(t => t.type === type).length || 0;
  };

  const templatesByType = templates?.reduce((acc, template) => {
    const type = template.type || 'OTHER';
    if (!acc[type]) acc[type] = [];
    acc[type].push(template);
    return acc;
  }, {} as Record<string, InvoiceTemplate[]>);

  const typeLabels: Record<string, { label: string; color: string; icon: typeof FileText }> = {
    BOLETA: { label: 'Boletas', color: 'from-blue-500 to-indigo-600', icon: FileText },
    TICKET: { label: 'Tickets', color: 'from-orange-500 to-amber-600', icon: Ticket },
    FACTURA: { label: 'Facturas', color: 'from-emerald-500 to-teal-600', icon: Receipt },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Plantillas de Documentos</h1>
            <p className="mt-1 text-slate-500">Crea y gestiona las plantillas para tus boletas, tickets y facturas</p>
          </div>
          <Button 
            onClick={() => router.push('/invoices/templates/new')} 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva Plantilla
          </Button>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {templatePresets.map((preset) => {
            const Icon = preset.icon;
            const count = getTemplateCount(preset.type);
            
            return (
              <Card 
                key={preset.type}
                className="group relative overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${preset.color} opacity-5`} />
                <div className="relative p-6">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-2xl bg-gradient-to-br ${preset.color} p-3 shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {count} {count === 1 ? 'plantilla' : 'plantillas'}
                    </span>
                  </div>
                  
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{preset.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{preset.description}</p>
                  
                  <Button
                    variant="ghost"
                    className="mt-4 w-full justify-between text-slate-600 hover:text-slate-900"
                    onClick={() => router.push('/invoices/templates/new?type=' + preset.type)}
                  >
                    Crear {preset.type.toLowerCase()}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {templates && templates.length > 0 && (
          <>
            {Object.entries(templatesByType || {}).map(([type, typeTemplates]) => {
              const typeInfo = typeLabels[type] || { label: type, color: 'from-slate-500 to-slate-600', icon: FileText };
              const TypeIcon = typeInfo.icon;
              
              return (
                <div key={type} className="mb-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className={`rounded-lg bg-gradient-to-br ${typeInfo.color} p-2`}>
                      <TypeIcon className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {typeInfo.label} ({typeTemplates.length})
                    </h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {typeTemplates.map((template) => {
                      const typeConfig = getTypeConfig(template.type);
                      const TemplateIcon = typeConfig.icon;
                      
                      return (
                        <Card 
                          key={template.id} 
                          className="group relative overflow-hidden border border-slate-200 transition-all hover:border-blue-300 hover:shadow-lg"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${typeConfig.color} opacity-0 transition-opacity group-hover:opacity-5`} />
                          <div className="relative p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`rounded-xl bg-gradient-to-br ${typeConfig.color} p-2 shadow-md`}>
                                  <TemplateIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-slate-900">{template.name}</h3>
                                  <p className="text-xs text-slate-500">
                                    {getPaperSizeLabel(template.paperSize)}
                                  </p>
                                </div>
                              </div>
                              {template.isDefault && (
                                <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                  <CheckCircle className="mr-1 inline h-3 w-3" />
                                  Default
                                </span>
                              )}
                            </div>
                            
                            {template.description && (
                              <p className="mt-3 text-sm text-slate-500">{template.description}</p>
                            )}

                            <div className="mt-4 flex flex-wrap gap-1">
                              {template.showCompany && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  <Building2 className="mr-1 inline h-3 w-3" />
                                  Empresa
                                </span>
                              )}
                              {template.showCustomer && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  <User className="mr-1 inline h-3 w-3" />
                                  Cliente
                                </span>
                              )}
                              {template.showItems && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  <Package className="mr-1 inline h-3 w-3" />
                                  Items
                                </span>
                              )}
                              {template.showTax && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  IGV {template.taxPercentage}%
                                </span>
                              )}
                              {template.showPaymentMethod && (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  <CreditCard className="mr-1 inline h-3 w-3" />
                                  Método
                                </span>
                              )}
                            </div>

                            <div className="mt-5 flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                                onClick={() => router.push(`/invoices/templates/${template.id}`)}
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('¿Estás seguro de eliminar esta plantilla?')) {
                                    deleteMutation.mutate(template.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {(!templates || templates.length === 0) && (
          <Card className="border-dashed border-2 border-slate-300 bg-white/50 p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Sparkles className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Sin plantillas aún</h3>
            <p className="mt-1 text-slate-500">Crea tu primera plantilla para comenzar a emitir documentos</p>
            <Button 
              onClick={() => router.push('/invoices/templates/new')} 
              className="mt-6 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Primera Plantilla
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
