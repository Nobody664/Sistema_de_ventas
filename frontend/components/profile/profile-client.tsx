'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { 
  Settings, 
  User, 
  Building2, 
  CreditCard, 
  Bell, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Loader2,
  Mail,
  Phone,
  Globe,
  Calendar,
  ChevronRight,
  MapPin,
  FileText
} from 'lucide-react';

type Subscription = {
  status: string;
  provider: string | null;
  billingCycle: string;
  endDate: string | null;
  startDate: string | null;
  plan?: { name: string; priceMonthly: string; code: string; features?: string[] };
};

type Company = {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  status: string;
  trialEndsAt: string | null;
  createdAt: string;
};

type ProfileClientProps = {
  initialSubscription: Subscription | null;
  initialCompany: Company | null;
  userName: string;
  userEmail: string;
};

export function ProfileClient({ initialSubscription, initialCompany, userName, userEmail }: ProfileClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(initialCompany);
  const [subscription, setSubscription] = useState<Subscription | null>(initialSubscription);
  const [loading, setLoading] = useState(!initialCompany);
  
  const [formData, setFormData] = useState({
    name: initialCompany?.name || '',
    phone: initialCompany?.phone || '',
    email: initialCompany?.email || '',
    timezone: initialCompany?.timezone || 'America/Lima',
  });

  useEffect(() => {
    if (initialCompany) {
      setFormData({
        name: initialCompany.name || '',
        phone: initialCompany.phone || '',
        email: initialCompany.email || '',
        timezone: initialCompany.timezone || 'America/Lima',
      });
    }
  }, [initialCompany]);

  const fullName = userName || userEmail || 'Usuario';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getCompanyStatus = () => {
    const isTrial = company?.status === 'TRIAL';
    const isActive = company?.status === 'ACTIVE';
    const isPastDue = company?.status === 'PAST_DUE';
    const isSuspended = company?.status === 'SUSPENDED';
    const isInactive = company?.status === 'INACTIVE';

    if (isPastDue) {
      return { 
        label: 'Pago pendiente', 
        description: 'Tu cuenta tiene un pago pendiente',
        color: 'text-orange-600', 
        bg: 'bg-orange-50 border-orange-200',
        dot: 'bg-orange-500'
      };
    }

    if (isSuspended) {
      return { 
        label: 'Suspendida', 
        description: 'Tu cuenta ha sido suspendida',
        color: 'text-red-600', 
        bg: 'bg-red-50 border-red-200',
        dot: 'bg-red-500'
      };
    }

    if (isInactive) {
      return { 
        label: 'Inactiva', 
        description: 'Tu cuenta ha sido desactivada',
        color: 'text-gray-600', 
        bg: 'bg-gray-50 border-gray-200',
        dot: 'bg-gray-500'
      };
    }

    if (isActive) {
      return { 
        label: 'Activa', 
        description: 'Tu cuenta está activa con todos los beneficios',
        color: 'text-emerald-600', 
        bg: 'bg-emerald-50 border-emerald-200',
        dot: 'bg-emerald-500'
      };
    }
    
    if (isTrial && company?.trialEndsAt) {
      const trialEnd = new Date(company.trialEndsAt);
      const now = new Date();
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft > 0) {
        return { 
          label: `Prueba (${daysLeft} días)`, 
          description: `Período de prueba gratuito`,
          color: 'text-amber-600', 
          bg: 'bg-amber-50 border-amber-200',
          dot: 'bg-amber-500'
        };
      }
    }

    return { 
      label: 'Activa', 
      description: 'Estado activo',
      color: 'text-slate-600', 
      bg: 'bg-slate-50 border-slate-200',
      dot: 'bg-slate-500'
    };
  };

  const menuItems = [
    { label: 'Mi Perfil', icon: User, href: '/profile', active: true },
    { label: 'Empresa', icon: Building2, href: '/settings/company' },
    { label: 'Suscripción', icon: CreditCard, href: '/subscription' },
    { label: 'Notificaciones', icon: Bell, href: '/notifications' },
  ];

  const companyStatus = getCompanyStatus();

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
          <p className="text-slate-500">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white border-0">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00aDJ2MmgtMnYtMnptLTQgNHYyaC0ydi0yaDJ6bTQtOGgydjJoLTJ2LTJ6bTgtOGgydjJoLTJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative flex items-center gap-6">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-5xl font-light tracking-wider border border-white/20">
            {initials}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Mi Perfil</p>
            <h1 className="font-display text-4xl font-semibold tracking-tight">{fullName}</h1>
            <p className="text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {userEmail}
            </p>
          </div>
          <div className="ml-auto">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${companyStatus.bg}`}>
              <span className={`w-2 h-2 rounded-full ${companyStatus.dot}`} />
              <span className={`font-medium ${companyStatus.color}`}>{companyStatus.label}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <Card className="rounded-3xl bg-white border-slate-200 p-2 h-fit">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return item.href.startsWith('#') ? (
                <a
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    item.active 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Link>
              );
            })}
          </nav>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {/* User Info Card */}
          <Card className="rounded-3xl bg-white border-0 p-0 overflow-hidden group">
            <div className="relative p-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptLTItNHYyaC0ydi0yaDJ6bTQtOGgydjJoLTJ2LTJ6bS04LTR2MmgtMnYtMmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
              
              <div className="relative">
                <h2 className="font-display text-xl font-semibold text-slate-900">Mi Perfil</h2>
                <p className="text-sm text-slate-500 mt-0.5">Información de tu cuenta</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 p-6 pt-0">
              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Nombre</span>
                </div>
                <p className="font-semibold text-slate-900 text-lg">{userName || '-'}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50">
                    <Mail className="w-5 h-5 text-rose-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Correo</span>
                </div>
                <p className="font-medium text-slate-900">{userEmail || '-'}</p>
              </div>
            </div>
          </Card>

          {/* Company Info Card */}
          <Card className="rounded-3xl bg-white border-0 p-0 overflow-hidden group">
            <div className="relative p-6 bg-gradient-to-br from-slate-50 to-slate-100/50">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptLTItNHYyaC0ydi0yaDJ6bTQtOGgydjJoLTJ2LTJ6bS04LTR2MmgtMnYtMmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-white shadow-lg shadow-slate-200/50">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-slate-900">Información de la Empresa</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Datos de tu organización</p>
                  </div>
                </div>
                <Link 
                  href="/settings/company"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium text-sm shadow-sm hover:shadow-md hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 group/btn"
                >
                  <Settings className="w-4 h-4 transition-transform group-hover/btn:rotate-45" />
                  Editar
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 p-6">
              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Empresa</span>
                </div>
                <p className="font-semibold text-slate-900 text-lg">{company?.name || '-'}</p>
                <p className="text-sm text-slate-500">@{company?.slug}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Creado</span>
                </div>
                <p className="font-semibold text-slate-900">
                  {company?.createdAt ? new Date(company.createdAt).toLocaleDateString('es-PE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) : '-'}
                </p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50">
                    <Mail className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Email</span>
                </div>
                <p className="font-medium text-slate-900">{company?.email || '-'}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50">
                    <Phone className="w-5 h-5 text-rose-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Teléfono</span>
                </div>
                <p className="font-medium text-slate-900">{company?.phone || '-'}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-violet-50">
                    <Globe className="w-5 h-5 text-violet-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Zona Horaria</span>
                </div>
                <p className="font-medium text-slate-900">{company?.timezone || '-'}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-50">
                    <FileText className="w-5 h-5 text-cyan-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">RUC</span>
                </div>
                <p className="font-medium text-slate-900 font-mono">{company?.taxId || '-'}</p>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow sm:col-span-2">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-orange-50">
                    <MapPin className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Dirección</span>
                </div>
                <p className="font-medium text-slate-900">{company?.address || '-'}</p>
              </div>
            </div>

            {company?.trialEndsAt && company.status === 'TRIAL' && (
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-900">Período de prueba</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Tu período de prueba termina el {' '}
                      <span className="font-semibold">
                        {new Date(company.trialEndsAt).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </p>
                    <Link 
                      href="/subscription"
                      className="mt-2 inline-flex items-center text-sm font-medium text-amber-800 hover:text-amber-900"
                    >
                      Ver planes disponibles →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Subscription Card */}
          <Card className="rounded-3xl bg-white border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-slate-900">Mi Suscripción</h2>
                <p className="text-sm text-slate-500 mt-1">Plan y facturación actual</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <CreditCard className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold">
                    {subscription?.plan?.name || 'Sin plan'}
                  </p>
                  <p className="text-slate-300 text-sm">
                    {subscription?.billingCycle === 'YEARLY' ? 'Facturación anual' : 'Facturación mensual'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-bold">
                  {subscription?.plan?.priceMonthly === '0' ? 'Gratis' : `S/ ${subscription?.plan?.priceMonthly}`}
                </p>
                {subscription?.plan?.priceMonthly !== '0' && (
                  <p className="text-slate-300 text-sm">/mes</p>
                )}
              </div>
            </div>

            {subscription?.endDate && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-500" />
                  <span className="text-sm text-slate-600">
                    {subscription.status === 'TRIALING' ? 'Período de prueba termina:' : 'Próximo cobro:'}
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {new Date(subscription.endDate).toLocaleDateString('es-PE', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}

            <Link
              href="/subscription"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Ver todos los planes
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
