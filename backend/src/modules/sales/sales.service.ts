import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import {
  Prisma,
  PrismaClient,
  AuditAction,
  SaleStatus,
  InventoryMovementType,
} from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  CreateSaleDto,
  ExportSalesQueryDto,
  QuerySalesDto,
} from "./dto/sale.dto";
import {
  NotificationsService,
  NotificationType,
} from "@/modules/notifications/notifications.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { ProductBatchesService } from "@/modules/product-batches/product-batches.service";
import { DistributorsService } from "@/modules/distributors/distributors.service";
import { DiscountsService } from "@/modules/discounts/discounts.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { CreditNotesService } from "@/modules/credit-notes/credit-notes.service";
import { AuditService } from "@/common/services/audit.service";
import {
  buildCsvExport,
  buildPdfExport,
  buildXlsxExport,
  ExportColumn,
} from "@/common/helpers/export.helper";

type PrismaTx = Omit<
  PrismaClient,
  "$on" | "$connect" | "$disconnect" | "$transaction" | "$use" | "$extends"
>;

type SaleExportRow = {
  saleNumber: string;
  status: string;
  customer: { firstName: string; lastName: string | null } | null;
  employee: { firstName: string } | null;
  totalAmount: unknown;
  paymentMethod: string;
  createdAt: Date;
  items: Array<{
    quantity: unknown;
    totalPrice: unknown;
    product: {
      name: string;
      description: string | null;
      sku: string | null;
    } | null;
  }>;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly lowStockService: LowStockService,
    private readonly kardexService: KardexService,
    private readonly productBatchesService: ProductBatchesService,
    private readonly auditService: AuditService,
    private readonly distributorsService: DistributorsService,
    private readonly discountsService: DiscountsService,
    private readonly planCapabilities: PlanCapabilitiesService,
    private readonly creditNotesService: CreditNotesService,
  ) {}

  findRecentSales(companyId: string, query: QuerySalesDto = {}) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

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
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findById(companyId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, companyId },
      include: {
        customer: true,
        employee: true,
        coupon: { select: { id: true, code: true, type: true, value: true } },
        items: {
          include: {
            product: {
              select: {
                name: true,
                description: true,
                sku: true,
                baseUnit: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException("Venta no encontrada.");
    }

    return sale;
  }

  async exportSales(companyId: string, query: ExportSalesQueryDto) {
    const where: Record<string, unknown> = { companyId };

    if (query.startDate) {
      where.createdAt = {
        ...(where.createdAt as object),
        gte: new Date(query.startDate),
      };
    }
    if (query.endDate) {
      where.createdAt = {
        ...(where.createdAt as object),
        lte: new Date(query.endDate),
      };
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
      orderBy: { createdAt: "desc" },
    });

    const format = query.format || "csv";

    const columns: ExportColumn<SaleExportRow>[] = [
      { header: "Numero", value: (s) => s.saleNumber, width: 2.5 },
      { header: "Estado", value: (s) => s.status, width: 1.5 },
      {
        header: "Cliente",
        value: (s) =>
          s.customer
            ? `${s.customer.firstName} ${s.customer.lastName || ""}`.trim()
            : "General",
        width: 3,
      },
      {
        header: "Vendedor",
        value: (s) => s.employee?.firstName || "",
        width: 2,
      },
      {
        header: "Productos",
        value: (s) =>
          s.items
            .map(
              (item) =>
                `${item.product?.name || "Producto"} x${Number(item.quantity)}`,
            )
            .join(" | "),
        width: 3,
      },
      {
        header: "Descripcion",
        value: (s) =>
          s.items
            .map((item) => item.product?.description || "")
            .filter((value) => value.length > 0)
            .join(" | "),
        width: 4,
      },
      {
        header: "SKU",
        value: (s) =>
          s.items
            .map((item) => item.product?.sku || "")
            .filter((value) => value.length > 0)
            .join(" | "),
        width: 2,
      },
      {
        header: "Total",
        value: (s) => Number(s.totalAmount),
        pdfValue: (s) => `S/ ${Number(s.totalAmount).toFixed(2)}`,
        width: 1.5,
      },
      { header: "Metodo de Pago", value: (s) => s.paymentMethod, width: 2 },
      {
        header: "Fecha",
        value: (s) => new Date(s.createdAt).toISOString().split("T")[0],
        width: 1.5,
      },
    ];

    if (format === "csv") {
      return buildCsvExport("ventas", columns, sales);
    }
    if (format === "excel") {
      return buildXlsxExport("ventas", "Ventas", columns, sales);
    }

    const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    return buildPdfExport(
      "ventas",
      "Reporte de Ventas",
      columns,
      sales,
      `Total: S/ ${totalSales.toFixed(2)} en ${sales.length} venta(s)`,
    );
  }

  async createSale(companyId: string, input: CreateSaleDto) {
    if (input.channel === "DISTRIBUTOR") {
      if (!input.distributorId) {
        throw new BadRequestException(
          "Debe seleccionar un distribuidor para el canal Distribuidor.",
        );
      }
      return this.distributorsService.registerSale(
        companyId,
        input.distributorId,
        {
          items: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: input.paymentMethod,
          taxAmount: input.taxAmount,
          discountAmount: input.discountAmount,
          customerId: input.customerId,
        },
      );
    }

    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        id: {
          in: Array.from(new Set(input.items.map((item) => item.productId))),
        },
      },
      include: { presentations: true },
    });

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    const resolvedItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found.`);
      }

      const presentation = item.presentationId
        ? product.presentations.find(
            (entry) => entry.id === item.presentationId,
          )
        : undefined;

      if (item.presentationId && !presentation) {
        throw new BadRequestException(
          `Presentation ${item.presentationId} not found.`,
        );
      }

      const factor = presentation ? presentation.factor : new Prisma.Decimal(1);
      const quantity = new Prisma.Decimal(item.quantity);
      const baseQuantity = quantity.mul(factor);
      const unitPrice = new Prisma.Decimal(
        presentation?.price ?? product.salePrice,
      );
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
        (
          baseQuantityByProduct.get(item.productId) ?? new Prisma.Decimal(0)
        ).plus(item.baseQuantity),
      );
    }

    for (const [productId, baseQuantity] of baseQuantityByProduct) {
      const product = productMap.get(productId);
      if (!product) continue;
      if (product.stockQuantity.lt(baseQuantity)) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name}. Disponible: ${Number(product.stockQuantity)}, solicitado: ${Number(baseQuantity)}.`,
        );
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

    if (input.couponCode && input.discountAmount && input.discountAmount > 0) {
      throw new BadRequestException(
        "No puedes combinar un cupon de descuento con un descuento manual.",
      );
    }

    if (
      input.couponCode ||
      (input.discountAmount && input.discountAmount > 0)
    ) {
      await this.assertDiscountsEnabled(companyId);
    }

    const taxAmount = new Prisma.Decimal(input.taxAmount ?? 0);
    const manualDiscount = new Prisma.Decimal(input.discountAmount ?? 0);
    const saleNumber = `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    if (input.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: input.customerId, companyId },
      });
      if (!customer) {
        throw new NotFoundException("Customer not found.");
      }
    }

    if (input.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: input.employeeId, companyId },
      });
      if (!employee) {
        throw new NotFoundException("Employee not found.");
      }
    }

    const sale = await this.prisma.$transaction(
      async (tx) => {
        let couponId: string | undefined;
        let discountAmount = manualDiscount;
        if (input.couponCode) {
          const applied = await this.discountsService.resolveForSale(
            tx,
            companyId,
            input.couponCode,
            subtotal,
          );
          couponId = applied.couponId;
          discountAmount = applied.discountAmount;
        }

        const totalAmount = subtotal.plus(taxAmount).minus(discountAmount);

        const created = await tx.sale.create({
          data: {
            companyId,
            customerId: input.customerId,
            employeeId: input.employeeId,
            channel: input.channel ?? "POS",
            couponId,
            saleNumber,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paymentMethod: input.paymentMethod,
            paidAmount: totalAmount,
            changeAmount: new Prisma.Decimal(0),
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
            throw new BadRequestException(
              `Stock insuficiente para el producto ${item.productId}.`,
            );
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
                type: "OUT" as const,
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
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Sale",
      entityId: sale.id,
      changes: {
        saleNumber: sale.saleNumber,
        subtotal: Number(subtotal),
        taxAmount: Number(taxAmount),
        discountAmount: Number(sale.discountAmount),
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

    for (const [productId, baseQuantity] of baseQuantityByProduct) {
      const product = productMap.get(productId);
      if (!product) {
        continue;
      }

      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId,
        productName: product.name,
        currentStock: product.stockQuantity.minus(baseQuantity),
        minStock: product.minStock,
        baseUnit: product.baseUnit,
        previousStock: product.stockQuantity,
      });
    }

    return sale;
  }

  private async assertDiscountsEnabled(companyId: string) {
    const capabilities = await this.planCapabilities.getCapabilities(companyId);
    if (!this.planCapabilities.hasFeature(capabilities, "sales.discounts")) {
      throw new ForbiddenException({
        error: "FEATURE_NOT_AVAILABLE",
        message: "Los descuentos no estan incluidos en tu plan actual.",
        features: ["sales.discounts"],
        currentPlan: capabilities.planCode,
        upgradeUrl: "/subscription",
      });
    }
  }

  cancelSale(
    companyId: string,
    id: string,
    userId: string | undefined,
    reason?: string,
  ) {
    return this.reverseSale(
      companyId,
      id,
      SaleStatus.CANCELLED,
      userId,
      reason,
    );
  }

  refundSale(
    companyId: string,
    id: string,
    userId: string | undefined,
    reason?: string,
  ) {
    return this.reverseSale(companyId, id, SaleStatus.REFUNDED, userId, reason);
  }

  private async reverseSale(
    companyId: string,
    id: string,
    targetStatus: SaleStatus,
    userId: string | undefined,
    reason?: string,
  ) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException("Venta no encontrada.");
    }
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se pueden anular o reembolsar ventas completadas. Estado actual: ${sale.status}.`,
      );
    }

    const label =
      targetStatus === SaleStatus.REFUNDED ? "Reembolso" : "Anulacion";
    const noteText = reason
      ? `${sale.notes ? `${sale.notes}\n` : ""}${label}: ${reason}`
      : sale.notes;

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const guard = await tx.sale.updateMany({
          where: { id, companyId, status: SaleStatus.COMPLETED },
          data: { status: targetStatus, notes: noteText },
        });
        if (guard.count !== 1) {
          throw new BadRequestException("La venta ya fue procesada.");
        }

        const productIds = Array.from(
          new Set(sale.items.map((item) => item.productId)),
        );
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, companyId },
          include: { presentations: true },
        });
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        for (const item of sale.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new NotFoundException(
              `Producto ${item.productId} no encontrado.`,
            );
          }

          const presentation = item.presentationId
            ? product.presentations.find(
                (entry) => entry.id === item.presentationId,
              )
            : undefined;
          const factor = presentation
            ? presentation.factor
            : new Prisma.Decimal(1);
          const baseQuantity = item.quantity.mul(factor);

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: baseQuantity } },
          });

          const movement = await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              presentationId: item.presentationId,
              type: InventoryMovementType.RETURN,
              quantity: baseQuantity,
              notes: `${label} de venta ${sale.saleNumber}`,
            },
          });

          await this.kardexService.recordInMovement(
            companyId,
            item.productId,
            baseQuantity,
            product.costPrice ?? new Prisma.Decimal(0),
            movement.id,
            tx,
          );
        }

        return tx.sale.findUnique({
          where: { id },
          include: { items: true, customer: true, employee: true },
        });
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.UPDATE,
      entity: "Sale",
      entityId: id,
      changes: {
        status: targetStatus,
        reason: reason ?? null,
        saleNumber: sale.saleNumber,
        reversedItems: sale.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
        })),
      },
    });

    if (targetStatus === SaleStatus.REFUNDED) {
      try {
        await this.creditNotesService.createFromRefund(
          companyId,
          userId,
          id,
          reason,
        );
      } catch {
        // La emision de la nota de credito no debe bloquear el reembolso.
      }
    }

    return updated;
  }
}
