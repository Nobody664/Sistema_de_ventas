import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateSaleDto, ExportSalesQueryDto } from './dto/sale.dto';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  findRecentSales(companyId: string) {
    try {
      console.log('[SalesService] Finding sales for company:', companyId);
      const sales = this.prisma.sale.findMany({
        where: { companyId },
        include: {
          customer: true,
          employee: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      console.log('[SalesService] Query constructed successfully');
      return sales;
    } catch (error) {
      console.error('[SalesService] Error fetching sales:', error);
      throw error;
    }
  }

  findById(companyId: string, id: string) {
    return this.prisma.sale.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        employee: true,
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  async exportSales(companyId: string, query: ExportSalesQueryDto) {
    const where: Record<string, unknown> = { companyId };

    if (query.startDate) {
      where.createdAt = { ...(where.createdAt as object), gte: new Date(query.startDate) };
    }
    if (query.endDate) {
      where.createdAt = { ...(where.createdAt as object), lte: new Date(query.endDate) };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        customer: true,
        employee: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const format = query.format || 'csv';

    if (format === 'csv') {
      return this.generateCsvExport(sales);
    } else if (format === 'excel') {
      return this.generateExcelExport(sales);
    } else {
      return this.generatePdfExport(sales);
    }
  }

  private generateCsvExport(sales: Array<{ saleNumber: string; status: string; customer: { firstName: string; lastName: string | null } | null; employee: { firstName: string } | null; totalAmount: unknown; paymentMethod: string; createdAt: Date }>) {
    const headers = ['Numero', 'Estado', 'Cliente', 'Vendedor', 'Total', 'Metodo de Pago', 'Fecha'];
    const rows = sales.map((s) => [
      s.saleNumber,
      s.status,
      s.customer ? `${s.customer.firstName} ${s.customer.lastName || ''}` : 'General',
      s.employee?.firstName || '',
      String(s.totalAmount),
      s.paymentMethod,
      new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const base64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    return {
      filename: `ventas_${new Date().toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv',
      data: base64,
    };
  }

  private generateExcelExport(sales: Array<{ saleNumber: string; status: string; customer: { firstName: string; lastName: string | null } | null; employee: { firstName: string } | null; totalAmount: unknown; paymentMethod: string; createdAt: Date }>) {
    const data = sales.map((s) => ({
      Numero: s.saleNumber,
      Estado: s.status,
      Cliente: s.customer ? `${s.customer.firstName} ${s.customer.lastName || ''}` : 'General',
      Vendedor: s.employee?.firstName || '',
      Total: Number(s.totalAmount),
      'Metodo de Pago': s.paymentMethod,
      Fecha: new Date(s.createdAt).toLocaleDateString(),
    }));

    const jsonStr = JSON.stringify(data);
    const base64 = Buffer.from(jsonStr, 'utf-8').toString('base64');

    return {
      filename: `ventas_${new Date().toISOString().split('T')[0]}.json`,
      contentType: 'application/json',
      data: base64,
    };
  }

  private generatePdfExport(sales: Array<{ saleNumber: string; status: string; customer: { firstName: string; lastName: string | null } | null; employee: { firstName: string } | null; totalAmount: unknown; paymentMethod: string; createdAt: Date }>) {
    const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .total { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Reporte de Ventas</h1>
          <p>Total de ventas: S/ ${totalSales.toFixed(2)}</p>
          <table>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Metodo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${sales.map((s) => `
                <tr>
                  <td>${s.saleNumber}</td>
                  <td>${s.customer ? `${s.customer.firstName} ${s.customer.lastName || ''}` : 'General'}</td>
                  <td>S/ ${Number(s.totalAmount).toFixed(2)}</td>
                  <td>${s.paymentMethod}</td>
                  <td>${new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const base64 = Buffer.from(html, 'utf-8').toString('base64');

    return {
      filename: `ventas_${new Date().toISOString().split('T')[0]}.html`,
      contentType: 'text/html',
      data: base64,
    };
  }

  async createSale(companyId: string, input: CreateSaleDto) {
    const products = (await this.prisma.product.findMany({
      where: {
        companyId,
        id: { in: input.items.map((item) => item.productId) },
      },
    })) as Array<{ id: string; stockQuantity: number; name: string; salePrice: unknown }>;

    const productMap = new Map<string, (typeof products)[number]>(products.map((product) => [product.id, product]));

    let subtotal = 0;
    const itemsData = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}.`);
      }

      const unitPrice = Number(product.salePrice);
      const totalPrice = unitPrice * item.quantity;

      subtotal += totalPrice;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
      };
    });

    const taxAmount = Number(input.taxAmount ?? 0);
    const discountAmount = Number(input.discountAmount ?? 0);
    const totalAmount = subtotal + taxAmount - discountAmount;
    const paidAmount = totalAmount;
    const changeAmount = 0;
    const saleNumber = `SALE-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          companyId,
          customerId: input.customerId,
          employeeId: input.employeeId,
          saleNumber,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paymentMethod: input.paymentMethod,
          paidAmount,
          changeAmount,
          items: {
            create: itemsData,
          },
        },
        include: { items: true },
      });

      await Promise.all(
        input.items.map(async (item) => {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });

          await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              type: 'OUT',
              quantity: item.quantity * -1,
              notes: `Sale ${sale.saleNumber}`,
            },
          });
        }),
      );

      return sale;
    });
  }
}