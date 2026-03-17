'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface LimitsInfo {
  limits: {
    maxUsers: number;
    maxProducts: number;
    maxCustomers: number;
    maxEmployees: number;
    maxCategories: number;
    features: string[];
  };
  usage: {
    products: number;
    users: number;
    customers: number;
    employees: number;
    categories: number;
    sales: number;
  };
  percentages: {
    products: number;
    users: number;
    customers: number;
    employees: number;
    categories: number;
    sales: number;
  };
}

export function useSubscriptionLimits(accessToken?: string) {
  const [limits, setLimits] = useState<LimitsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = async (module: 'products' | 'employees' | 'customers') => {
    setLoading(true);
    try {
      const data = await apiFetch<LimitsInfo>(`/${module}/limits`, { token: accessToken });
      setLimits(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching limits:', err);
      setError('Error al cargar límites');
    } finally {
      setLoading(false);
    }
  };

  return { limits, loading, error, fetchLimits };
}

export function getLimitWarning(limits: LimitsInfo | null): string | null {
  if (!limits) return null;

  const { usage, limits: l, percentages } = limits;

  const warnings = [];

  if (percentages.products >= 80) {
    warnings.push(`Productos: ${usage.products}/${l.maxProducts} (${percentages.products}%)`);
  }
  if (percentages.employees >= 80) {
    warnings.push(`Empleados: ${usage.employees}/${l.maxEmployees} (${percentages.employees}%)`);
  }
  if (percentages.customers >= 80) {
    warnings.push(`Clientes: ${usage.customers}/${l.maxCustomers} (${percentages.customers}%)`);
  }
  if (percentages.categories >= 80) {
    warnings.push(`Categorías: ${usage.categories}/${l.maxCategories} (${percentages.categories}%)`);
  }

  return warnings.length > 0 ? warnings.join(', ') : null;
}

export function isLimitExceeded(limits: LimitsInfo | null, resource: keyof LimitsInfo['usage']): boolean {
  if (!limits) return false;
  return limits.percentages[resource] >= 100;
}
