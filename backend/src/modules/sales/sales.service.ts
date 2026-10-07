import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateSaleDto, ExportSalesQueryDto } from './dto/sale.dto';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';
import { KardexService } from '@/modules/kardex/kardex.service';
import { ProductBatchesService } from '@/modules/product-batches/product-batches.service';
import { AuditService } from '@/common/services/audit.service';

type PrismaTx = Omit<PrismaClient, '$on' | '$connect' | '$disconnect' | '$transaction' | '$use' | '$extends'>;

function escapeHtml(value: unknown): string {
  const text = String(value ?? '');
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (chr) => map[chr] as string);
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly kardexService: KardexService,
    private readonly productBatchesService: ProductBatchesService,
    private readonly auditService: AuditService,
  ) {}

  findRecentSales(companyId: string) {
    return this.prisma.sale.findMany({
      where: { companyId },
      select: {
        id: true,
        saleNumber: true,
        totalAmount: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
        employee: { select: { firstName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
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
                  <td>${escapeHtml(s.saleNumber)}</td>
                  <td>${s.customer ? escapeHtml(`${s.customer.firstName} ${s.customer.lastName || ''}`) : 'General'}</td>
                  <td>S/ ${Number(s.totalAmount).toFixed(2)}</td>
                  <td>${escapeHtml(s.paymentMethod)}</td>
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
    const quantityByProduct = new Map<string, number>();
    for (const item of input.items) {
      quantityByProduct.set(
        item.productId,
        (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const saleItems = Array.from(quantityByProduct, ([productId, quantity]) => ({ productId, quantity }));

    const products = (await this.prisma.product.findMany({
      where: {
        companyId,
        id: { in: saleItems.map((item) => item.productId) },
      },
    })) as Array<{ id: string; stockQuantity: number; name: string; salePrice: unknown }>;

    const productMap = new Map<string, (typeof products)[number]>(products.map((product) => [product.id, product]));

    let subtotal = 0;
    const itemsData = saleItems.map((item) => {
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

    if (input.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, companyId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found.');
      }
    }

    if (input.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, companyId },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found.');
      }
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sale.create({
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

      for (const item of saleItems) {
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            companyId,
            stockQuantity: { gte: item.quantity },
          },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (stockUpdate.count !== 1) {
          throw new BadRequestException(`Insufficient stock for product ${item.productId}.`);
        }
      }

      for (const item of saleItems) {
        await this.productBatchesService.reserveFromBatch(
          companyId,
          item.productId,
          item.quantity,
          tx,
        );
      }

      const movements = await Promise.all(
        saleItems.map((item) =>
          tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              type: 'OUT' as const,
              quantity: item.quantity * -1,
              notes: `Sale ${saleNumber}`,
            },
          }),
        ),
      );

      await Promise.all(
        movements.map((movement, index) =>
          this.kardexService.recordOutMovement(
            companyId,
            saleItems[index].productId,
            saleItems[index].quantity,
            movement.id,
            tx,
          ),
        ),
      );

      return created;
    }, { maxWait: 10_000, timeout: 15_000 });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: 'Sale',
      entityId: sale.id,
      changes: {
        saleNumber: sale.saleNumber,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount: Number(sale.totalAmount),
        paymentMethod: sale.paymentMethod,
        customerId: sale.customerId,
        employeeId: sale.employeeId,
        items: sale.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          totalPrice: Number(item.totalPrice),
        })),
      },
    });

    return sale;
  }
}