import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Users, UserPlus, Mail, Phone } from 'lucide-react';
import { CustomerActions, NewCustomerButton } from '@/components/customers/customer-actions';
import type { Customer } from '@/types/api';
import Link from 'next/link';

export default async function CustomersPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const customers = await serverApiFetch<Customer[]>('/customers', accessToken);

  const totalCustomers = customers?.length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-cyan-500 to-blue-600 p-8 text-white animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">CRM basico</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestion de clientes</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra tu base de clientes, registra nuevos clientes y observa su historial de compras.
            </p>
          </div>
          <div className="hidden sm:block animate-fade-in-up delay-150">
            <NewCustomerButton />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/20 p-2">
              <Users className="size-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total clientes</p>
              <p className="font-display text-3xl">{totalCustomers}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-green-500/20 p-2">
              <UserPlus className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Nuevos este mes</p>
              <p className="font-display text-3xl">
                {customers?.filter((c) => new Date(c.createdAt).getMonth() === new Date().getMonth()).length ?? 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Directorio</p>
            <h2 className="mt-2 font-display text-2xl">Clientes registrados</h2>
          </div>
          <div className="sm:hidden">
            <NewCustomerButton />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 max-h-[600px] overflow-auto">
          {(customers?.length ?? 0) > 0 ? (
            customers?.map((customer, index) => (
              <div
                key={customer.id}
                className="flex items-center justify-between rounded-2xl border border-foreground/10 p-4 transition hover:border-cyan-500/30 card-hover animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
              >
                <Link
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-4 flex-1"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 font-medium">
                    {customer.firstName[0]}
                    {(customer.lastName || '')[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-sm text-foreground/50">
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="size-3" />
                          {customer.email}
                        </span>
                      )}
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
                          {customer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="text-right">
                  <CustomerActions customer={customer} />
                  <p className="mt-2 font-display text-lg">
                    S/ {(
                      Number(customer.totalPurchases || 0) +
                      (customer.sales?.reduce((acc, s) => acc + Number(s.totalAmount), 0) || 0)
                    ).toFixed(2)}
                  </p>
                  <p className="text-xs text-foreground/50">compras</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 py-8 text-center text-foreground/50">
              No hay clientes registrados. Registra el primero y comienza a operar!!.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
