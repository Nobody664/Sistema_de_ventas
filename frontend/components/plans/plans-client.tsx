'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch, getAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Check, Crown, Zap, Rocket, Star, Users, Package, Building2, Layers, KeyRound, Loader2 } from 'lucide-react';
import type { Plan } from '@/types/generated';
import {
  FEATURE_LABELS,
  MODULE_LABELS,
  PLAN_FEATURE_KEYS,
  PLAN_MODULE_KEYS,
} from '@/lib/plan-capabilities';

type AdminPlan = Plan & {
  modules?: string[];
  permissions?: string[];
  apiEnabled?: boolean;
  apiSearchDniEnabled?: boolean;
  apiQuota?: number;
};

interface PlansClientProps {
  initialPlans: AdminPlan[];
}

const emptyFormData = {
  code: '',
  name: '',
  description: '',
  priceMonthly: '',
  priceYearly: '',
  billingCycle: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
  maxUsers: '',
  maxProducts: '',
  features: '',
  modules: [] as string[],
  permissions: [] as string[],
  apiEnabled: false,
  apiSearchDniEnabled: false,
  apiQuota: '0',
  isActive: true,
};

export function PlansClient({ initialPlans }: PlansClientProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<AdminPlan[]>(initialPlans);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [formData, setFormData] = useState(emptyFormData);

  const planColors: Record<string, string> = {
    FREE: 'from-gray-500 to-slate-600',
    START: 'from-blue-500 to-indigo-600',
    GROWTH: 'from-violet-500 to-purple-600',
    SCALE: 'from-amber-500 to-orange-600',
  };

  const planIcons: Record<string, typeof Zap> = {
    FREE: Zap,
    START: Rocket,
    GROWTH: Crown,
    SCALE: Star,
  };

  const parseFeatures = (features: unknown): string[] => {
    if (Array.isArray(features)) {
      return features as string[];
    }
    return [];
  };

  const handleOpenDialog = (plan?: AdminPlan) => {
    setSaveError(null);
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        code: plan.code,
        name: plan.name,
        description: plan.description || '',
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        billingCycle: plan.billingCycle,
        maxUsers: plan.maxUsers?.toString() || '',
        maxProducts: plan.maxProducts?.toString() || '',
        features: parseFeatures(plan.features).join('\n'),
        modules: parseFeatures(plan.modules),
        permissions: parseFeatures(plan.permissions),
        apiEnabled: plan.apiEnabled ?? false,
        apiSearchDniEnabled: plan.apiSearchDniEnabled ?? false,
        apiQuota: plan.apiQuota?.toString() || '0',
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setFormData({ ...emptyFormData, priceMonthly: '0', priceYearly: '0' });
    }
    setIsDialogOpen(true);
  };

  const toggleInArray = (key: 'modules' | 'permissions', value: string) => {
    setFormData((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const planFields = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        priceMonthly: parseFloat(formData.priceMonthly),
        priceYearly: parseFloat(formData.priceYearly),
        billingCycle: formData.billingCycle,
        ...(formData.maxUsers ? { maxUsers: parseInt(formData.maxUsers, 10) } : {}),
        ...(formData.maxProducts ? { maxProducts: parseInt(formData.maxProducts, 10) } : {}),
        features: formData.features.split('\n').filter(f => f.trim()),
        modules: formData.modules,
        permissions: formData.permissions,
        apiEnabled: formData.apiEnabled,
        apiSearchDniEnabled: formData.apiSearchDniEnabled,
        apiQuota: formData.apiQuota ? parseInt(formData.apiQuota, 10) : 0,
        isActive: formData.isActive,
      };
      const signal = AbortSignal.timeout(20_000);
      const token = getAccessToken();
      let savedPlan: AdminPlan;

      if (editingPlan) {
        savedPlan = await apiFetch<AdminPlan>(`/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(planFields),
          token,
          signal,
        });
      } else {
        savedPlan = await apiFetch<AdminPlan>('/plans', {
          method: 'POST',
          body: JSON.stringify({ code: formData.code.trim(), ...planFields, billingCycle: 'MONTHLY' }),
          token,
          signal,
        });
      }

      setPlans((currentPlans) => {
        const nextPlans = editingPlan
          ? currentPlans.map((plan) => (plan.id === savedPlan.id ? savedPlan : plan))
          : [...currentPlans, savedPlan];
        return nextPlans.sort((left, right) => Number(left.priceMonthly) - Number(right.priceMonthly));
      });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving plan:', error);
      setSaveError(
        error instanceof DOMException && error.name === 'TimeoutError'
          ? 'La solicitud tardó demasiado. Comprueba tu conexión e inténtalo nuevamente.'
          : error instanceof Error
            ? error.message
            : 'No se pudo guardar el plan.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('¿Estás seguro de eliminar este plan?')) return;
    
    setLoading(true);
    try {
      await apiFetch(`/plans/${planId}`, {
        method: 'DELETE',
        token: getAccessToken(),
      });
      
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      const updatedPlans = await apiFetch<AdminPlan[]>('/plans', {
        token: getAccessToken(),
      });
      setPlans(updatedPlans || []);
    } catch (error) {
      console.error('Error deleting plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlanStatus = async (plan: Plan) => {
    setLoading(true);
    try {
      await apiFetch(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !plan.isActive }),
        token: getAccessToken(),
      });
      
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      const updatedPlans = await apiFetch<AdminPlan[]>('/plans', {
        token: getAccessToken(),
      });
      setPlans(updatedPlans || []);
    } catch (error) {
      console.error('Error toggling plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const activePlans = plans.filter(p => p.isActive);
  const inactivePlans = plans.filter(p => !p.isActive);

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-violet-600 to-indigo-700 p-6 sm:p-8 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Administración</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">Planes</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Configura los planes de suscripción disponibles en la plataforma. 
              Define precios, características y límites para cada plan.
            </p>
          </div>
          <Button 
            onClick={() => handleOpenDialog()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-medium text-violet-600 transition hover:bg-white/90 sm:w-auto"
          >
            <Plus className="size-4" />
            Nuevo Plan
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total planes</p>
          <p className="mt-4 font-display text-3xl">{plans.length}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Planes activos</p>
          <p className="mt-4 font-display text-3xl text-green-600">{activePlans.length}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Planes inactivos</p>
          <p className="mt-4 font-display text-3xl text-gray-400">{inactivePlans.length}</p>
        </Card>
        <Card className="rounded-[30px] bg-white/80 p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Precio desde</p>
          <p className="mt-4 font-display text-3xl text-violet-600">
            S/ {Math.min(...activePlans.map(p => parseFloat(p.priceMonthly))).toFixed(0)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const Icon = planIcons[plan.code] || Crown;
          const colorClass = planColors[plan.code] || 'from-violet-500 to-purple-600';
          const monthlyPrice = parseFloat(plan.priceMonthly);
          const yearlyPrice = parseFloat(plan.priceYearly);
          const price = plan.billingCycle === 'YEARLY' ? yearlyPrice : monthlyPrice;

          return (
            <Card 
              key={plan.id} 
              className={`group relative rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg ${!plan.isActive ? 'opacity-50' : ''}`}
            >
              {!plan.isActive && (
                <span className="absolute -top-2 -right-2 rounded-full bg-gray-500 px-3 py-1 text-xs font-medium text-white">
                  Inactivo
                </span>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass} text-white`}>
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-xl">{plan.name}</h3>
                    <code className="truncate text-xs text-foreground/50">{plan.code}</code>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleOpenDialog(plan)}
                    className="rounded-lg p-2 hover:bg-foreground/5"
                    title="Editar"
                  >
                    <Edit className="size-4 text-foreground/50" />
                  </button>
                  {plan.code !== 'FREE' && (
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="rounded-lg p-2 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              {plan.description && (
                <p className="mt-3 text-sm text-foreground/60">{plan.description}</p>
              )}

              <div className="mt-6">
                <p className="font-display text-4xl">
                  {price === 0 ? 'Gratis' : `S/ ${price}`}
                  {price > 0 && <span className="text-lg font-normal text-foreground/50">/{plan.billingCycle === 'YEARLY' ? 'año' : 'mes'}</span>}
                </p>
                {price > 0 && (
                  <p className="text-sm text-foreground/50">
                    S/ {monthlyPrice}/mes · S/ {yearlyPrice}/año
                  </p>
                )}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <Users className="size-4" />
                  <span>{plan.maxUsers === 999 ? 'Ilimitados' : `${plan.maxUsers} usuarios`}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <Package className="size-4" />
                  <span>{plan.maxProducts === 999999 ? 'Ilimitados' : `${plan.maxProducts} productos`}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <Building2 className="size-4" />
                  <span>Facturación {plan.billingCycle === 'MONTHLY' ? 'mensual' : 'anual'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <Layers className="size-4" />
                  <span>{parseFeatures(plan.modules).length} módulos incluidos</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/60">
                  <KeyRound className="size-4" />
                  <span>
                    {plan.apiEnabled
                      ? `API habilitada${plan.apiSearchDniEnabled ? ' · DNI/RUC' : ''}${plan.apiQuota ? ` · ${plan.apiQuota.toLocaleString('es-PE')} req/mes` : ''}`
                      : 'Sin acceso a API'}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t border-foreground/10 pt-4">
                <p className="mb-3 text-sm font-medium text-foreground/70">Características:</p>
                <ul className="space-y-2">
                  {parseFeatures(plan.features).slice(0, 4).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {parseFeatures(plan.features).length > 4 && (
                    <li className="text-sm text-foreground/50">
                      +{parseFeatures(plan.features).length - 4} características más
                    </li>
                  )}
                </ul>
              </div>

              <Button
                variant={plan.isActive ? 'outline' : 'default'}
                size="sm"
                className="mt-4 w-full"
                onClick={() => togglePlanStatus(plan)}
                disabled={loading}
              >
                {plan.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plan' : 'Nuevo Plan'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="ej. GROWTH"
                  disabled={!!editingPlan}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Growth"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCycle">Ciclo de facturación</Label>
              <select
                id="billingCycle"
                value={formData.billingCycle}
                onChange={(event) => setFormData({ ...formData, billingCycle: event.target.value as 'MONTHLY' | 'YEARLY' })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción breve del plan"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="priceMonthly">Precio mensual (S/)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  step="0.01"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  placeholder="59.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceYearly">Precio anual (S/)</Label>
                <Input
                  id="priceYearly"
                  type="number"
                  step="0.01"
                  value={formData.priceYearly}
                  onChange={(e) => setFormData({ ...formData, priceYearly: e.target.value })}
                  placeholder="590.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">Máximo usuarios</Label>
                <Input
                  id="maxUsers"
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
                  placeholder="15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxProducts">Máximo productos</Label>
                <Input
                  id="maxProducts"
                  type="number"
                  value={formData.maxProducts}
                  onChange={(e) => setFormData({ ...formData, maxProducts: e.target.value })}
                  placeholder="10000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Características (una por línea)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="3 sucursales&#10;Reportes avanzados&#10;Roles personalizados"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Módulos incluidos</Label>
              <p className="text-xs text-foreground/50">
                Determinan qué secciones del sistema están habilitadas para las empresas con este plan.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLAN_MODULE_KEYS.map((moduleKey) => (
                  <label
                    key={moduleKey}
                    className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-violet-600"
                      checked={formData.modules.includes(moduleKey)}
                      onChange={() => toggleInArray('modules', moduleKey)}
                    />
                    <span>{MODULE_LABELS[moduleKey] ?? moduleKey}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permisos y funciones</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLAN_FEATURE_KEYS.map((featureKey) => (
                  <label
                    key={featureKey}
                    className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-violet-600"
                      checked={formData.permissions.includes(featureKey)}
                      onChange={() => toggleInArray('permissions', featureKey)}
                    />
                    <span>{FEATURE_LABELS[featureKey] ?? featureKey}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-input p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="apiEnabled">Acceso a API</Label>
                  <p className="text-xs text-foreground/50">Habilita el uso de integraciones por API.</p>
                </div>
                <input
                  id="apiEnabled"
                  type="checkbox"
                  className="size-4 accent-violet-600"
                  checked={formData.apiEnabled}
                  onChange={(e) => setFormData({ ...formData, apiEnabled: e.target.checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="apiSearchDni">Búsqueda DNI/RUC</Label>
                  <p className="text-xs text-foreground/50">Solo disponible en planes altos.</p>
                </div>
                <input
                  id="apiSearchDni"
                  type="checkbox"
                  className="size-4 accent-violet-600"
                  checked={formData.apiSearchDniEnabled}
                  disabled={!formData.apiEnabled}
                  onChange={(e) => setFormData({ ...formData, apiSearchDniEnabled: e.target.checked })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiQuota">Cuota de API por mes</Label>
                <Input
                  id="apiQuota"
                  type="number"
                  value={formData.apiQuota}
                  disabled={!formData.apiEnabled}
                  onChange={(e) => setFormData({ ...formData, apiQuota: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600" role="alert">{saveError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {editingPlan ? 'Guardar cambios' : 'Crear plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
