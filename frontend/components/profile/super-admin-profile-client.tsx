'use client';

import { Card } from '@/components/ui/card';
import { 
  Settings, 
  User, 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp,
  Crown,
  Activity,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

type DashboardStats = {
  totalCompanies: number;
  activeCompanies: number;
  trialCompanies: number;
  totalUsers: number;
  totalSubscriptions: number;
};

type Company = {
  id: string;
  name: string;
  slug: string;
  status: string;
  email: string | null;
  phone: string | null;
};

type SuperAdminProfileClientProps = {
  userName: string;
  userEmail: string;
  stats: DashboardStats | null;
  companies: Company[];
};

export function SuperAdminProfileClient({ userName, userEmail, stats, companies }: SuperAdminProfileClientProps) {
  const fullName = userName || userEmail || 'Administrador';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const menuItems = [
    { label: 'Dashboard', icon: Activity, href: '/dashboard', active: true },
    { label: 'Empresas', icon: Building2, href: '/companies' },
    { label: 'Planes', icon: CreditCard, href: '/subscriptions' },
    { label: 'Usuarios', icon: Users, href: '/subscribers' },
    { label: 'Configuración', icon: Settings, href: '/settings' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Activa</span>;
      case 'TRIAL':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Prueba</span>;
      case 'PAST_DUE':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Pago pendiente</span>;
      case 'SUSPENDED':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Suspendida</span>;
      case 'INACTIVE':
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Inactiva</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-8 text-white border-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgNHYyaC0ydi0yaDJ6bTQtOGgydjJoLTJ2LTJ6bTgtOGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-center gap-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-5xl font-light tracking-wider border border-white/20">
            {initials}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-purple-300">Panel de Administración</p>
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{fullName}</h1>
            <p className="text-purple-300">{userEmail}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <Card className="rounded-3xl bg-white border-slate-200 p-2 h-fit">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    item.active 
                      ? 'bg-purple-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                  {!item.active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl bg-white border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Empresas</p>
                  <p className="font-display text-3xl font-bold text-slate-900 mt-1">{stats?.totalCompanies ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-100">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Activas</p>
                  <p className="font-display text-3xl font-bold text-emerald-600 mt-1">{stats?.activeCompanies ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">En Prueba</p>
                  <p className="font-display text-3xl font-bold text-amber-600 mt-1">{stats?.trialCompanies ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100">
                  <CreditCard className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl bg-white border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Usuarios</p>
                  <p className="font-display text-3xl font-bold text-slate-900 mt-1">{stats?.totalUsers ?? 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-100">
                  <Users className="w-6 h-6 text-slate-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Companies List */}
          <Card className="rounded-3xl bg-white border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900">Empresas Recientes</h2>
                <p className="text-sm text-slate-500 mt-1">Últimas empresas registradas en el sistema</p>
              </div>
              <Link
                href="/companies"
                className="text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                Ver todas →
              </Link>
            </div>

            <div className="space-y-3">
              {companies.slice(0, 5).map((company) => (
                <div 
                  key={company.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{company.name}</p>
                      <p className="text-sm text-slate-500">@{company.slug}</p>
                    </div>
                  </div>
                  {getStatusBadge(company.status)}
                </div>
              ))}
              {companies.length === 0 && (
                <p className="text-center text-slate-500 py-8">No hay empresas registradas</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
