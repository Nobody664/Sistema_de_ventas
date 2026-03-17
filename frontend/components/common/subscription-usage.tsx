'use client';

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useSubscriptionLimits } from '@/hooks/use-subscription-limits';

interface LimitsUsageBarProps {
  resource: 'products' | 'employees' | 'customers' | 'categories';
  label: string;
  icon?: React.ReactNode;
}

function ResourceBar({ resource, label, icon }: LimitsUsageBarProps) {
  const { limits, loading, fetchLimits } = useSubscriptionLimits();

  useEffect(() => {
    fetchLimits(resource === 'categories' ? 'products' : resource);
  }, [resource]);

  if (loading || !limits) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground/60">{label}</span>
        <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
      </div>
    );
  }

  const usage = limits.usage[resource];
  const max = limits.limits[`max${resource.charAt(0).toUpperCase()}${resource.slice(1)}` as keyof typeof limits.limits] as number;
  const percentage = limits.percentages[resource];

  const getStatus = () => {
    if (percentage >= 100) return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500' };
    if (percentage >= 80) return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500' };
    return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500' };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-sm ${status.color}`}>
          {usage} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={`h-full transition-all ${status.bg}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {percentage >= 80 && (
        <p className={`text-xs ${percentage >= 100 ? 'text-red-500' : 'text-amber-500'}`}>
          {percentage >= 100
            ? 'Has alcanzado el límite. Upgrade tu plan para continuar.'
            : `Casi llegas al límite (${percentage}%)`}
        </p>
      )}
    </div>
  );
}

export function SubscriptionUsage() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-white p-6">
      <h3 className="font-display text-lg mb-4">Uso de tu plan</h3>
      <div className="space-y-4">
        <ResourceBar resource="products" label="Productos" />
        <ResourceBar resource="customers" label="Clientes" />
        <ResourceBar resource="employees" label="Empleados" />
        <ResourceBar resource="categories" label="Categorías" />
      </div>
    </div>
  );
}
