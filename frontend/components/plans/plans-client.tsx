'use client';

import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { Plus, Edit, Trash2, Check, Crown, Zap, Rocket, Star, DollarSign, Users, Package, Building2, Loader2 } from 'lucide-react';
import type { Plan } from '@/types/generated';

interface PlansClientProps {
  initialPlans: Plan[];
}

export function PlansClient({ initialPlans }: PlansClientProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    maxUsers: '',
    maxProducts: '',
    features: '',
    isActive: true,
  });

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

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        code: plan.code,
        name: plan.name,
        description: plan.description || '',
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxUsers: plan.maxUsers?.toString() || '',
        maxProducts: plan.maxProducts?.toString() || '',
        features: parseFeatures(plan.features).join('\n'),
        isActive: plan.isActive,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        code: '',
        name: '',
        description: '',
        priceMonthly: '0',
        priceYearly: '0',
        maxUsers: '',
        maxProducts: '',
        features: '',
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        priceMonthly: parseFloat(formData.priceMonthly),
        priceYearly: parseFloat(formData.priceYearly),
        maxUsers: formData.maxUsers ? parseInt(formData.maxUsers) : null,
        maxProducts: formData.maxProducts ? parseInt(formData.maxProducts) : null,
        features: formData.features.split('\n').filter(f => f.trim()),
      };

      if (editingPlan) {
        await apiFetch(`/plans/${editingPlan.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          token: session?.accessToken,
        });
      } else {
        await apiFetch('/plans', {
          method: 'POST',
          body: JSON.stringify(payload),
          token: session?.accessToken,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['plans'] });
      setIsDialogOpen(false);
      
      const updatedPlans = await apiFetch<Plan[]>('/plans', {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      setPlans(updatedPlans || []);
    } catch (error) {
      console.error('Error saving plan:', error);
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
        token: session?.accessToken,
      });
      
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      const updatedPlans = await apiFetch<Plan[]>('/plans', {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
        token: session?.accessToken,
      });
      
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      const updatedPlans = await apiFetch<Plan[]>('/plans', {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
      <Card className="rounded-[34px] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Administración</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Planes</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Configura los planes de suscripción disponibles en la plataforma. 
              Define precios, características y límites para cada plan.
            </p>
          </div>
          <Button 
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-medium text-violet-600 transition hover:bg-white/90"
          >
            <Plus className="size-4" />
            Nuevo Plan
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
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
          const price = parseFloat(plan.priceMonthly);

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

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${colorClass} text-white`}>
                    <Icon className="size-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl">{plan.name}</h3>
                    <code className="text-xs text-foreground/50">{plan.code}</code>
                  </div>
                </div>
                <div className="flex gap-1">
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
                  {price > 0 && <span className="text-lg font-normal text-foreground/50">/mes</span>}
                </p>
                {price > 0 && (
                  <p className="text-sm text-foreground/50">
                    S/ {parseFloat(plan.priceYearly)}/año (ahorro {Math.round((1 - parseFloat(plan.priceYearly) / (price * 12)) * 100)}%)
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
                  <span>{plan.billingCycle === 'MONTHLY' ? 'Facturación mensual' : 'Facturación anual'}</span>
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
            <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción breve del plan"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
          </div>

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
