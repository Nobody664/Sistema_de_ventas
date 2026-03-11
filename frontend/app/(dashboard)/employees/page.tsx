import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Users, Search, Shield, Mail, Phone, Calendar, MoreHorizontal } from 'lucide-react';
import { EmployeeActions, NewEmployeeButton } from '@/components/employees/employee-actions';
import type { Employee } from '@/types/api';

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  COMPANY_ADMIN: { label: 'Admin', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  MANAGER: { label: 'Gerente', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  CASHIER: { label: 'Cajero', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  STAFF: { label: 'Personal', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

export default async function EmployeesPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const employees = await serverApiFetch<Employee[]>('/employees', accessToken);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-4xl">Empleados</h1>
          <p className="mt-1 text-foreground/50">Gestiona los usuarios y roles de tu empresa</p>
        </div>
        <NewEmployeeButton />
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar empleados..."
            className="w-full rounded-2xl border border-foreground/10 bg-white py-3 pl-12 pr-4"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {employees && employees.length > 0 ? (
          employees.map((employee) => {
            const role = roleConfig[employee.role] || roleConfig.STAFF;
            return (
              <Card key={employee.id} className="group rounded-[30px] bg-white/80 p-6 transition hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600">
                      {employee.firstName.charAt(0)}
                      {employee.lastName?.charAt(0) || ''}
                    </div>
                    <div>
                      <h3 className="font-display text-lg">
                        {employee.firstName} {employee.lastName}
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${role.bg} ${role.color}`}>
                        <Shield className="size-3" />
                        {role.label}
                      </span>
                    </div>
                  </div>
                  <button className="rounded-lg p-2 opacity-0 transition hover:bg-foreground/5 group-hover:opacity-100">
                    <MoreHorizontal className="size-5 text-foreground/40" />
                  </button>
                </div>

                <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${employee.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                  <span className={`h-2 w-2 rounded-full ${employee.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={`text-xs font-medium ${employee.isActive ? 'text-green-700' : 'text-gray-600'}`}>
                    {employee.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  {employee.email && (
                    <div className="flex items-center gap-2 text-foreground/60">
                      <Mail className="size-4" />
                      <span>{employee.email}</span>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-foreground/60">
                      <Phone className="size-4" />
                      <span>{employee.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Calendar className="size-4" />
                    <span>Desde {new Date(employee.createdAt).toLocaleDateString('es-PE')}</span>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <EmployeeActions employee={employee} />
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-3 flex flex-col items-center justify-center py-16">
            <Users className="size-16 text-foreground/20" />
            <h3 className="mt-4 font-display text-xl">No hay empleados</h3>
            <p className="mt-1 text-foreground/50">Los empleados apareceran aqui cuando los registres.</p>
          </div>
        )}
      </div>
    </div>
  );
}
