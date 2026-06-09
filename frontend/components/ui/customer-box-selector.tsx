'use client';

import { useState, useMemo } from 'react';
import { Users, Search, FileText, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Customer } from '@/types/api';

interface CustomerBoxSelectorProps {
  customers: Customer[];
  selectedId?: string | null;
  onSelect: (customer: Customer | null) => void;
}

function getInitials(firstName: string, lastName?: string | null): string {
  const first = firstName?.charAt(0) ?? '';
  const last = lastName?.charAt(0) ?? '';
  return (first + last).toUpperCase().slice(0, 2) || '?';
}

export function CustomerBoxSelector({ customers, selectedId, onSelect }: CustomerBoxSelectorProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName?.toLowerCase().includes(q) ||
        c.documentValue?.includes(q) ||
        c.email?.toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Clientes frecuentes
        </p>
        <span className="text-xs text-muted-foreground">{customers.length} registrados</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar clientes..."
          className="h-9 pl-9 rounded-lg text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="size-8 mb-2 opacity-40" />
            <p className="text-sm">No hay clientes</p>
          </div>
        ) : (
          filtered.map((customer) => {
            const isSelected = selectedId === customer.id;
            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => onSelect(isSelected ? null : customer)}
                className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                    : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                }`}
              >
                {isSelected && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-sm">
                    <Check className="size-3" />
                  </span>
                )}
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isSelected
                      ? 'bg-accent text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {getInitials(customer.firstName, customer.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {customer.firstName} {customer.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <FileText className="mr-0.5 inline size-3 align-text-bottom" />
                    {customer.documentValue || '—'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
