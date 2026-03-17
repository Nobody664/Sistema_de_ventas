'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, ArrowLeft, Loader2, MapPin, Phone, Mail, FileText, Hash, CheckCircle, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

interface CompanyData {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
}

export default function CompanySettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxId: '',
    address: '',
    email: '',
    phone: '',
  });

  const [isInitialized, setIsInitialized] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-current'],
    queryFn: () => apiFetch<CompanyData>('/companies/current', { token: session?.accessToken }),
    enabled: !!session?.accessToken,
  });

  useEffect(() => {
    if (company && !isInitialized) {
      setFormData({
        name: company.name || '',
        legalName: company.legalName || '',
        taxId: company.taxId || '',
        address: company.address || '',
        email: company.email || '',
        phone: company.phone || '',
      });
      setIsInitialized(true);
    }
  }, [company, isInitialized]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CompanyData>) =>
      apiFetch<CompanyData>('/companies/current', {
        method: 'PATCH',
        token: session?.accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['company-current'], data);
      addToast('Datos de la empresa actualizados correctamente', 'success');
    },
    onError: (error: Error) => {
      addToast(error.message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      addToast('El nombre de la empresa es requerido', 'error');
      return;
    }

    if (formData.taxId && formData.taxId.length !== 11) {
      addToast('El RUC debe tener 11 dígitos', 'error');
      return;
    }

    updateMutation.mutate({
      name: formData.name,
      legalName: formData.legalName || null,
      taxId: formData.taxId || null,
      address: formData.address || null,
      email: formData.email || null,
      phone: formData.phone || null,
    });
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading || !company) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-indigo-500 animate-spin"></div>
            <Building2 className="absolute inset-0 m-auto h-6 w-6 text-indigo-500" />
          </div>
          <p className="mt-4 text-sm text-slate-500">Cargando datos de la empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/50 -ml-3"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptLTItNHYyaC0ydi0yaDJ6bTQtOGgydjJoLTJ2LTJ6bS04LTR2MmgtMnYtMmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 blur-3xl"></div>
        
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-xs text-white/70">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Configuración</span>
          </div>
        </div>
        
        <div className="relative flex items-center gap-6">
          <div className="relative">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 shadow-2xl shadow-indigo-500/30">
              <Building2 className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/50">Empresa</p>
            <h1 className="font-display text-4xl tracking-tight mt-1">Datos de la Empresa</h1>
            <p className="mt-2 text-white/70">Gestiona la información legal, fiscal y de contacto</p>
          </div>
        </div>
      </div>

      <Card className="rounded-3xl border-0 shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500"></div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Información Principal</h3>
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nombre de la Empresa <span className="text-red-500">*</span>
                </Label>
                <div className="relative group">
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Mi Empresa SAC"
                    className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all pl-12 text-base"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 group-focus-within:bg-indigo-100 group-focus-within:text-indigo-600 transition-colors">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="legalName" className="text-sm font-semibold text-slate-700">
                  Razón Social
                </Label>
                <Input
                  id="legalName"
                  value={formData.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                  placeholder="Mi Empresa Sociedad Anónima Cerrada"
                  className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all text-base"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50">
                <Hash className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Identificación Fiscal</h3>
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="taxId" className="text-sm font-semibold text-slate-700">
                RUC <span className="text-slate-400 font-normal">(Registro Único de Contribuyente)</span>
              </Label>
              <div className="relative group">
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => updateField('taxId', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="10472251271"
                  maxLength={11}
                  className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all pl-12 text-base font-mono tracking-widest"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 group-focus-within:bg-amber-100 group-focus-within:text-amber-600 transition-colors">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <p className="text-xs text-slate-400 pl-1">El RUC debe tener 11 dígitos para ser válido</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50">
                <MapPin className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Ubicación</h3>
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="address" className="text-sm font-semibold text-slate-700">
                Dirección Fiscal
              </Label>
              <div className="relative group">
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Av. Principal 123, Lima, Perú"
                  className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all pl-12 text-base"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 group-focus-within:bg-rose-100 group-focus-within:text-rose-600 transition-colors">
                  <MapPin className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50">
                <Phone className="h-5 w-5 text-cyan-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Contacto</h3>
            </div>
            
            <div className="grid gap-6">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Correo Electrónico
                </Label>
                <div className="relative group">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="contacto@miempresa.com"
                    className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all pl-12 text-base"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 group-focus-within:bg-cyan-100 group-focus-within:text-cyan-600 transition-colors">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="phone" className="text-sm font-semibold text-slate-700">
                  Teléfono
                </Label>
                <div className="relative group">
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+51 999 999 999"
                    className="h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-0 focus:shadow-lg focus:shadow-indigo-500/10 transition-all pl-12 text-base"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 group-focus-within:bg-cyan-100 group-focus-within:text-cyan-600 transition-colors">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-slate-100">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Los cambios se aplicarán inmediatamente</span>
            </div>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="h-14 px-10 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-700 hover:via-purple-700 hover:to-indigo-700 text-white font-semibold shadow-2xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group/btn"
            >
              <span className="relative z-10 flex items-center gap-2">
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5" />
                    Guardar Cambios
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
