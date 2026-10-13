import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, AuditAction } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CreateSaleDto, ExportSalesQueryDto } from './dto/sale.dto';
import { NotificationsService, NotificationType } from '@/modules/notifications/notifications.service';
import { KardexService } from '@/modules/kardex/kardex.service';
import { ProductBatchesService } from '@/modules/product-batches/product-batches.service';
import { DistributorsService } from '@/modules/distributors/distributors.service';
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
    private readonly distributorsService: DistributorsService,
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
        channel: true,
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
    if (query.channel) {
      where.channel = query.channel;
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
    if (input.channel === 'DISTRIBUTOR') {
      if (!input.distributorId) {
        throw new BadRequestException('Debe seleccionar un distribuidor para el canal Distribuidor.');
      }
      return this.distributorsService.registerSale(companyId, input.distributorId, {
        items: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod: input.paymentMethod,
        taxAmount: input.taxAmount,
        discountAmount: input.discountAmount,
        customerId: input.customerId,
      });
    }

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        id: { in: Array.from(new Set(input.items.map((item) => item.productId))) },
      },
      include: { presentations: true },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    const resolvedItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      const presentation = item.presentationId
        ? product.presentations.find((entry) => entry.id === item.presentationId)
        : undefined;

      if (item.presentationId && !presentation) {
        throw new BadRequestException(`Presentation ${item.presentationId} not found.`);
      }

      const factor = presentation ? presentation.factor : new Prisma.Decimal(1);
      const quantity = new Prisma.Decimal(item.quantity);
      const baseQuantity = quantity.mul(factor);
      const unitPrice = new Prisma.Decimal(presentation?.price ?? product.salePrice);
      const totalPrice = unitPrice.mul(quantity);

      return {
        productId: item.productId,
        productName: product.name,
        presentationId: presentation?.id,
        quantity,
        baseQuantity,
        unitPrice,
        totalPrice,
      };
    });

    const baseQuantityByProduct = new Map<string, Prisma.Decimal>();
    for (const item of resolvedItems) {
      baseQuantityByProduct.set(
        item.productId,
        (baseQuantityByProduct.get(item.productId) ?? new Prisma.Decimal(0)).plus(item.baseQuantity),
      );
    }

    for (const [productId, baseQuantity] of baseQuantityByProduct) {
      const product = productMap.get(productId);
      if (!product) continue;
      if (product.stockQuantity.lt(baseQuantity)) {
        throw new BadRequestException(`Insufficient stock for ${product.name}.`);
      }
    }

    let subtotal = new Prisma.Decimal(0);
    const itemsData = resolvedItems.map((item) => {
      subtotal = subtotal.plus(item.totalPrice);
      return {
        productId: item.productId,
        presentationId: item.presentationId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      };
    });

    const taxAmount = new Prisma.Decimal(input.taxAmount ?? 0);
    const discountAmount = new Prisma.Decimal(input.discountAmount ?? 0);
    const totalAmount = subtotal.plus(taxAmount).minus(discountAmount);
    const paidAmount = totalAmount;
    const changeAmount = new Prisma.Decimal(0);
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
          channel: input.channel ?? 'POS',
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

      for (const item of resolvedItems) {
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            companyId,
            stockQuantity: { gte: item.baseQuantity },
          },
          data: { stockQuantity: { decrement: item.baseQuantity } },
        });
        if (stockUpdate.count !== 1) {
          throw new BadRequestException(`Insufficient stock for product ${item.productId}.`);
        }
      }

      for (const item of resolvedItems) {
        await this.productBatchesService.reserveFromBatch(
          companyId,
          item.productId,
          item.baseQuantity,
          tx,
        );
      }

      const movements = await Promise.all(
        resolvedItems.map((item) =>
          tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              presentationId: item.presentationId,
              type: 'OUT' as const,
              quantity: item.baseQuantity.neg(),
              notes: `Sale ${saleNumber}`,
            },
          }),
        ),
      );

      await Promise.all(
        movements.map((movement, index) =>
          this.kardexService.recordOutMovement(
            companyId,
            resolvedItems[index].productId,
            resolvedItems[index].baseQuantity,
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
        subtotal: Number(subtotal),
        taxAmount: Number(taxAmount),
        discountAmount: Number(discountAmount),
        totalAmount: Number(sale.totalAmount),
        paymentMethod: sale.paymentMethod,
        customerId: sale.customerId,
        employeeId: sale.employeeId,
        items: sale.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          totalPrice: Number(item.totalPrice),
        })),
      },
    });

    return sale;
  }
}