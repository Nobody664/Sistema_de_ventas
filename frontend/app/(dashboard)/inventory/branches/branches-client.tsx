'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Building2, Plus, MapPin } from 'lucide-react';
import { apiFetch, getAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

interface BranchesPageClientProps {
  initialBranches: Array<Record<string, unknown>>;
}

export function BranchesPageClient({ initialBranches }: BranchesPageClientProps) {
  const user = useAuthStore((state) => state.user);
  const [branches, setBranches] = useState(initialBranches);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const isAdmin = user?.roles?.includes('COMPANY_ADMIN') ?? false;
  const activeBranches = branches.filter((b) => b.isActive !== false);

  const handleCreate = async () => {
    try {
      const created = await apiFetch('/branches', {
        method: 'POST',
        body: JSON.stringify(form),
        token: getAccessToken(),
      });
      setBranches([...branches, created as Record<string, unknown>]);
      setShowForm(false);
      setForm({ name: '', address: '' });
    } catch (e) {
      console.error('Error creating branch:', e);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const updated = await apiFetch(`/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !current }),
        token: getAccessToken(),
      });
      setBranches(branches.map((b) => (b.id === id ? (updated as Record<string, unknown>) : b)));
    } catch (e) {
      console.error('Error updating branch:', e);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-amber-500 to-orange-700 p-8 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inventario</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Sucursales</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra múltiples sucursales y almacenes para tu negocio.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <Plus className="size-4" />
              Nueva sucursal
            </button>
          )}
        </div>
      </Card>

      {isAdmin && showForm && (
        <Card className="rounded-[30px] bg-white/85 p-6 animate-fade-in-up">
          <h3 className="font-display text-lg mb-4">Nueva sucursal</h3>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-foreground/50 mb-1">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-foreground/10 bg-white px-4 py-2.5 text-sm transition focus:border-amber-500/50 focus:outline-none"
                placeholder="Sucursal principal"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-foreground/50 mb-1">Dirección</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-xl border border-foreground/10 bg-white px-4 py-2.5 text-sm transition focus:border-amber-500/50 focus:outline-none"
                placeholder="Av. Principal 123"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-foreground/10 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-foreground/5"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {activeBranches.length > 0 ? (
          activeBranches.map((branch, i) => (
            <Card
              key={branch.id as string}
              className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-2xl bg-amber-500/20 p-2">
                  <Building2 className="size-5 text-amber-600" />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleToggleActive(branch.id as string, true)}
                    className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Desactivar
                  </button>
                )}
              </div>
              <h3 className="mt-4 font-display text-lg">{String(branch.name)}</h3>
              {branch.address ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-foreground/50">
                  <MapPin className="size-3" />
                  {String(branch.address)}
                </p>
              ) : null}
            </Card>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-foreground/50">
            No hay sucursales registradas.
          </div>
        )}
      </div>
    </div>
  );
}
