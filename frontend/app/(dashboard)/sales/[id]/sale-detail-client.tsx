'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, FileText, User, Calendar, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { Sale } from '@/types/api';

interface SaleDetailClientProps {
  sale: Sale;
}

export function SaleDetailClient({ sale: initialSale }: SaleDetailClientProps) {
  const { data: session } = useSession();

  const handlePrint = async () => {
    try {
      const response = await apiFetch<{ html: string }>(`/invoices/generate/${initialSale.id}`, {
        token: session?.accessToken,
      });

      if (response?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(response.html);
          printWindow.document.close();
          printWindow.print();
        }
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const paymentMethods: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
  };

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        <div className="mb-8">
          <Link
            href="/sales"
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 p-3 shadow-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Venta #{initialSale.saleNumber}</h1>
                <p className="text-sm text-slate-500">
                  {initialSale.paidAt 
                    ? new Date(initialSale.paidAt).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Sin fecha'}
                </p>
              </div>
            </div>
            <Button onClick={handlePrint} className="bg-orange-500 hover:bg-orange-600">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-slate-400" />
              Información del cliente
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-medium">
                  {initialSale.customer 
                    ? `${initialSale.customer.firstName} ${initialSale.customer.lastName || ''}`
                    : 'Cliente general'}
                </p>
              </div>
              {initialSale.employee && (
                <div>
                  <p className="text-sm text-slate-500">Vendedor</p>
                  <p className="font-medium">
                    {initialSale.employee.firstName} {initialSale.employee.lastName || ''}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              Productos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-slate-500">Producto</th>
                    <th className="pb-3 text-center text-sm font-medium text-slate-500">Cant.</th>
                    <th className="pb-3 text-right text-sm font-medium text-slate-500">P. Unit</th>
                    <th className="pb-3 text-right text-sm font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {initialSale.items?.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3">{item.productName || 'Producto'}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-right">S/ {Number(item.unitPrice).toFixed(2)}</td>
                      <td className="py-3 text-right">S/ {Number(item.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-400" />
              Resumen de pago
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>S/ {Number(initialSale.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(initialSale.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">IGV</span>
                  <span>S/ {Number(initialSale.taxAmount).toFixed(2)}</span>
                </div>
              )}
              {Number(initialSale.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento</span>
                  <span>-S/ {Number(initialSale.discountAmount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Total</span>
                <span className="text-orange-600">S/ {Number(initialSale.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3">
                <span className="text-slate-500">Método de pago</span>
                <span className="font-medium">{paymentMethods[initialSale.paymentMethod] || initialSale.paymentMethod}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
