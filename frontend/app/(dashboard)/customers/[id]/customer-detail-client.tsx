'use client';

import Link from 'next/link';
import { ArrowLeft, User, Mail, Phone, FileText, ShoppingCart, DollarSign, Calendar, Edit, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Customer, Sale } from '@/types/api';

interface CustomerWithPurchases {
  purchases: Sale[];
  stats: {
    totalSpent: number;
    purchaseCount: number;
    lastPurchaseDate: string | null;
    averageTicket: number;
  };
}

interface CustomerDetailClientProps {
  customer: Customer;
  purchasesData: CustomerWithPurchases | null;
}

export function CustomerDetailClient({ customer, purchasesData }: CustomerDetailClientProps) {
  const purchases = purchasesData?.purchases || [];
  const stats = purchasesData?.stats || {
    totalSpent: 0,
    purchaseCount: 0,
    lastPurchaseDate: null,
    averageTicket: 0,
  };

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-8">
          <Link
            href="/customers"
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a clientes
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-4 shadow-lg">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {customer.firstName} {customer.lastName}
                </h1>
                <p className="text-sm text-slate-500">
                  Cliente desde {new Date(customer.createdAt).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/customers/${customer.id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5 text-slate-400" />
                Información personal
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Nombre completo</p>
                  <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                </div>
                {customer.documentType && customer.documentValue && (
                  <div>
                    <p className="text-sm text-slate-500">Documento</p>
                    <p className="font-medium">{customer.documentType}: {customer.documentValue}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-500">Correo</p>
                  <p className="font-medium">{customer.email || 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Teléfono</p>
                  <p className="font-medium">{customer.phone || 'No registrado'}</p>
                </div>
                {customer.notes && (
                  <div>
                    <p className="text-sm text-slate-500">Notas</p>
                    <p className="text-sm">{customer.notes}</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-slate-400" />
                Estadísticas
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total gastado</span>
                  <span className="font-bold text-green-600">S/ {stats.totalSpent.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Compras realizadas</span>
                  <span className="font-medium">{stats.purchaseCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ticket promedio</span>
                  <span className="font-medium">S/ {stats.averageTicket.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Última compra</span>
                  <span className="font-medium">
                    {stats.lastPurchaseDate 
                      ? new Date(stats.lastPurchaseDate).toLocaleDateString('es-PE')
                      : 'Sin compras'}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="rounded-2xl p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-slate-400" />
                Historial de compras ({purchases.length})
              </h2>
              
              {purchases.length > 0 ? (
                <div className="space-y-3">
                  {purchases.map((sale) => (
                    <Link
                      key={sale.id}
                      href={`/sales/${sale.id}`}
                      className="flex items-center justify-between rounded-xl border p-4 transition hover:border-blue-300 hover:bg-blue-50/50"
                    >
                      <div>
                        <p className="font-medium">{sale.saleNumber}</p>
                        <p className="text-sm text-slate-500">
                          {sale.paidAt 
                            ? new Date(sale.paidAt).toLocaleDateString('es-PE', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Sin fecha'}
                          {sale.employee && ` • Vendedor: ${sale.employee.firstName}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg font-bold text-green-600">
                          S/ {Number(sale.totalAmount || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">{sale.paymentMethod}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500">
                  <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4">Este cliente no tiene compras registradas</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
