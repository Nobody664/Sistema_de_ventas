import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Users, UserPlus, Shield, Mail, Phone, Calendar } from 'lucide-react';
import { EmployeeActions, NewEmployeeButton } from '@/components/employees/employee-actions';
import type { Employee } from '@/types/api';
import Link from 'next/link';

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  COMPANY_ADMIN: { label: 'Admin', color: 'text-violet-700', bg: 'bg-violet-50' },
  MANAGER: { label: 'Gerente', color: 'text-blue-700', bg: 'bg-blue-50' },
  CASHIER: { label: 'Cajero', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  STAFF: { label: 'Personal', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export default async function EmployeesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const employees = await serverApiFetch<Employee[]>('/employees', accessToken);

  const totalEmployees = employees?.length ?? 0;
  const activeEmployees = employees?.filter(e => e.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="rounded-[34px] bg-gradient-to-br from-purple-500 to-violet-600 p-8 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">RRHH</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestión de empleados</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra los usuarios y roles de tu empresa. Controla el acceso y permisos de tu equipo.
            </p>
          </div>
          <div className="hidden sm:block animate-fade-in-up delay-150">
            <NewEmployeeButton />
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/20 p-2">
              <Users className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total empleados</p>
              <p className="font-display text-3xl">{totalEmployees}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/20 p-2">
              <Shield className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Empleados activos</p>
              <p className="font-display text-3xl">{activeEmployees}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Employee List */}
      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Directorio</p>
            <h2 className="mt-2 font-display text-2xl">Empleados registrados</h2>
          </div>
          <div className="sm:hidden">
            <NewEmployeeButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 max-h-[600px] overflow-auto">
          {(employees?.length ?? 0) > 0 ? (
            employees?.map((employee, index) => {
              const role = roleConfig[employee.role] || roleConfig.STAFF;
              return (
                <div
                  key={employee.id}
                  className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4 transition hover:border-purple-500/30 card-hover animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                >
                  <Link
                    href={`/employees/${employee.id}/edit`}
                    className="flex items-center gap-4 flex-1"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${role.bg} ${role.color} font-medium`}>
                      {employee.firstName[0]}
                      {(employee.lastName || '')[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-foreground/50">
                        <span className={`flex items-center gap-1 ${role.color}`}>
                          <Shield className="size-3" />
                          {role.label}
                        </span>
                        {employee.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="size-3" />
                            {employee.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="text-right">
                    <EmployeeActions employee={employee} />
                    <p className={`mt-2 font-display text-lg ${employee.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {employee.isActive ? 'Activo' : 'Inactivo'}
                    </p>
                    <p className="text-xs text-foreground/50">
                      Desde {new Date(employee.createdAt).toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 py-8 text-center text-foreground/50">
              No hay empleados registrados. Registra el primero y comienza a operar!!
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
