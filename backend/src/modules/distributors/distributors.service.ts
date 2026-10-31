import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { AuditAction, Prisma, PrismaClient } from "@prisma/client";
import type { DistributorBalance } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { LowStockService } from "@/modules/low-stock/low-stock.service";
import { ProductBatchesService } from "@/modules/product-batches/product-batches.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import {
  SalesActor,
  canReadCompanySales,
} from "@/common/helpers/sales-visibility.helper";
import {
  resolveSaleLines,
  saleAmounts,
} from "@/common/helpers/sale-pricing.helper";
import { randomUUID } from "crypto";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { enqueueDomainEffect } from "@/modules/outbox/outbox-event.helper";
import {
  creditDistributorStock,
  debitDistributorStock,
  requireDistributorStock,
} from "./distributor-stock.helper";
import {
  CreateDistributorDeliveryDto,
  CreateDistributorDto,
  MoveDistributorStockDto,
  QueryDistributorsDto,
  RegisterDistributorSaleDto,
  SettleDistributorDto,
  UpdateDistributorDto,
  ReconcileDistributorStockDto,
} from "./dto/distributor.dto";

type PrismaTx = Omit<
  PrismaClient,
  "$on" | "$connect" | "$disconnect" | "$transaction" | "$use" | "$extends"
>;

interface StockItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class DistributorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kardexService: KardexService,
    private readonly lowStockService: LowStockService,
    private readonly productBatchesService: ProductBatchesService,
    private readonly auditService: AuditService,
    private readonly planCapabilities: PlanCapabilitiesService,
  ) {}

  private mergeItems(items: Array<{ productId: string; quantity: number }>) {
    const map = new Map<string, { productId: string; quantity: number }>();
    for (const item of items) {
      const existing = map.get(item.productId);
      if (existing) {
        existing.quantity = new Prisma.Decimal(existing.quantity)
          .plus(item.quantity)
          .toNumber();
      } else {
        map.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }
    return [...map.values()];
  }

  private withBalance<T extends { balances: DistributorBalance[] }>(row: T) {
    const { balances, ...rest } = row;
    return { ...rest, balance: balances[0] ?? null };
  }

  private async getDistributorOrFail(companyId: string, id: string) {
    const distributor = await this.prisma.distributor.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { balances: true },
    });
    if (!distributor) {
      throw new NotFoundException("Distribuidor no encontrado.");
    }
    return this.withBalance(distributor);
  }

  async findAll(companyId: string, query: QueryDistributorsDto) {
    const where: Prisma.DistributorWhereInput = { companyId, deletedAt: null };

    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
        { documentValue: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.distributor.findMany({
      where,
      include: { balances: true },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => this.withBalance(row));
  }

  async create(companyId: string, dto: CreateDistributorDto) {
    const existing = await this.prisma.distributor.findFirst({
      where: { companyId, code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Ya existe un distribuidor con ese codigo.");
    }

    const distributor = await this.prisma.distributor.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        type: dto.type ?? "INDIVIDUAL",
        documentType: dto.documentType,
        documentValue: dto.documentValue,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        commissionRate: dto.commissionRate,
        priceListId: dto.priceListId,
        notes: dto.notes,
        balances: { create: {} },
      },
      include: { balances: true },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "Distributor",
      entityId: distributor.id,
      changes: { code: distributor.code, name: distributor.name },
    });

    return this.withBalance(distributor);
  }

  async update(companyId: string, id: string, dto: UpdateDistributorDto) {
    const current = await this.getDistributorOrFail(companyId, id);

    if (dto.code && dto.code !== current.code) {
      const clash = await this.prisma.distributor.findFirst({
        where: { companyId, code: dto.code, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException("Ese codigo ya esta en uso.");
      }
    }

    const distributor = await this.prisma.distributor.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.documentType !== undefined
          ? { documentType: dto.documentType }
          : {}),
        ...(dto.documentValue !== undefined
          ? { documentValue: dto.documentValue }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.commissionRate !== undefined
          ? { commissionRate: dto.commissionRate }
          : {}),
        ...(dto.priceListId !== undefined
          ? { priceListId: dto.priceListId }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { balances: true },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Distributor",
      entityId: distributor.id,
      changes: { ...dto },
    });

    return this.withBalance(distributor);
  }

  async remove(companyId: string, id: string) {
    const distributor = await this.getDistributorOrFail(companyId, id);

    const balanceQuantity = distributor.balance?.balanceQuantity ?? 0;
    const debtAmount = distributor.balance?.debtAmount ?? new Prisma.Decimal(0);
    if (Number(balanceQuantity) > 0 || debtAmount.gt(0)) {
      throw new BadRequestException(
        "No se puede eliminar un distribuidor con mercaderia o deuda pendiente.",
      );
    }

    await this.prisma.distributor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "Distributor",
      entityId: id,
      changes: { code: distributor.code },
    });

    return { deleted: true };
  }

  findOne(companyId: string, id: string) {
    return this.getDistributorOrFail(companyId, id);
  }

  async findStock(companyId: string, id: string) {
    await this.getDistributorOrFail(companyId, id);
    return this.prisma.distributorStock.findMany({
      where: { distributorId: id, quantity: { gt: 0 } },
      select: { productId: true, quantity: true },
      orderBy: { productId: "asc" },
    });
  }

  async reconcileStock(
    companyId: string,
    id: string,
    input: ReconcileDistributorStockDto,
    userId: string,
  ) {
    return serializableTransaction(this.prisma, async (tx) => {
      const distributor = await tx.distributor.findFirst({
        where: { id, companyId, deletedAt: null },
        include: { balances: true },
      });
      if (!distributor)
        throw new NotFoundException("Distribuidor no encontrado");
      if (distributor.stockReconciled)
        throw new BadRequestException(
          "El distribuidor ya tiene stock conciliado",
        );
      if (
        new Set(input.items.map((item) => item.productId)).size !==
        input.items.length
      )
        throw new BadRequestException("No repitas productos");
      const products = await tx.product.count({
        where: {
          id: { in: input.items.map((item) => item.productId) },
          companyId,
        },
      });
      if (products !== input.items.length)
        throw new NotFoundException("Producto no encontrado");
      const total = input.items.reduce(
        (sum, item) => sum.plus(item.quantity),
        new Prisma.Decimal(0),
      );
      if (!total.equals(distributor.balances[0]?.balanceQuantity ?? 0))
        throw new BadRequestException(
          "El detalle debe coincidir con el saldo agregado existente",
        );
      for (const item of input.items)
        await tx.distributorStock.upsert({
          where: {
            distributorId_productId: {
              distributorId: id,
              productId: item.productId,
            },
          },
          create: {
            distributorId: id,
            productId: item.productId,
            quantity: item.quantity,
          },
          update: { quantity: item.quantity },
        });
      await tx.distributor.update({
        where: { id },
        data: { stockReconciled: true },
      });
      await this.auditService.log(
        {
          companyId,
          userId,
          action: AuditAction.UPDATE,
          entity: "Distributor",
          entityId: id,
          changes: {
            operation: "RECONCILE_STOCK",
            reason: input.reason,
            items: input.items,
          },
        },
        tx,
      );
      return { reconciled: true };
    });
  }

  async getBalance(companyId: string, id: string) {
    const distributor = await this.getDistributorOrFail(companyId, id);
    return (
      distributor.balance ?? {
        distributorId: distributor.id,
        startingQuantity: 0,
        returnedQuantity: 0,
        soldQuantity: 0,
        balanceQuantity: 0,
        debtAmount: new Prisma.Decimal(0),
      }
    );
  }

  async transfer(companyId: string, id: string, dto: MoveDistributorStockDto) {
    const distributor = await this.getDistributorOrFail(companyId, id);
    if (distributor.status !== "ACTIVE") {
      throw new BadRequestException("El distribuidor no esta activo.");
    }

    const items = this.mergeItems(dto.items);
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        minStock: true,
        baseUnit: true,
        salePrice: true,
      },
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundException(
          `Producto ${item.productId} no encontrado.`,
        );
      }
      if (Number(product.stockQuantity) < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${product.name}.`,
        );
      }
    }

    const totalQuantity = items
      .reduce((sum, item) => sum.plus(item.quantity), new Prisma.Decimal(0))
      .toNumber();
    const totalDebt = items
      .reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        return sum.plus(
          new Prisma.Decimal(product.salePrice).mul(item.quantity),
        );
      }, new Prisma.Decimal(0))
      .toDecimalPlaces(2)
      .toNumber();

    const result = await this.prisma.$transaction(
      async (tx) => {
        await requireDistributorStock(tx, companyId, id);
        for (const item of items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              companyId,
              stockQuantity: { gte: item.quantity },
            },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (updated.count !== 1) {
            throw new BadRequestException(
              `Stock insuficiente para el producto ${item.productId}.`,
            );
          }
        }

        for (const item of items) {
          await this.productBatchesService.reserveFromBatch(
            companyId,
            item.productId,
            new Prisma.Decimal(item.quantity),
            tx,
          );
        }

        for (const item of items) {
          const movement = await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              distributorId: distributor.id,
              type: "TRANSFER",
              quantity: item.quantity * -1,
              notes: dto.notes ?? "Transferencia a distribuidor",
            },
          });

          await creditDistributorStock(
            tx,
            id,
            item.productId,
            new Prisma.Decimal(item.quantity),
          );

          await this.kardexService.recordOutMovement(
            companyId,
            item.productId,
            new Prisma.Decimal(item.quantity),
            movement.id,
            tx,
          );
        }

        const balance = await tx.distributorBalance.upsert({
          where: { distributorId: distributor.id },
          create: {
            distributorId: distributor.id,
            startingQuantity: totalQuantity,
            balanceQuantity: totalQuantity,
            debtAmount: new Prisma.Decimal(totalDebt),
          },
          update: {
            startingQuantity: { increment: totalQuantity },
            balanceQuantity: { increment: totalQuantity },
            debtAmount: { increment: totalDebt },
          },
        });

        return {
          distributorId: distributor.id,
          transferredQuantity: totalQuantity,
          debtAdded: totalDebt,
          balance,
        };
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Distributor",
      entityId: distributor.id,
      changes: { operation: "TRANSFER", items, totalQuantity, totalDebt },
    });

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        continue;
      }

      await this.lowStockService.notifyIfLowStock({
        companyId,
        productId: item.productId,
        productName: product.name,
        currentStock: product.stockQuantity.minus(item.quantity),
        minStock: product.minStock,
        baseUnit: product.baseUnit,
        previousStock: product.stockQuantity,
      });
    }

    return result;
  }

  async returnGoods(
    companyId: string,
    id: string,
    dto: MoveDistributorStockDto,
  ) {
    const distributor = await this.getDistributorOrFail(companyId, id);

    const items = this.mergeItems(dto.items);
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: items.map((item) => item.productId) } },
      select: { id: true, name: true, costPrice: true, expiryDate: true },
    });
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        throw new NotFoundException(
          `Producto ${item.productId} no encontrado.`,
        );
      }
    }

    const totalQuantity = items
      .reduce((sum, item) => sum.plus(item.quantity), new Prisma.Decimal(0))
      .toNumber();
    const balanceQuantity = distributor.balance?.balanceQuantity ?? 0;
    if (Number(balanceQuantity) < totalQuantity) {
      throw new BadRequestException(
        "El distribuidor no tiene mercaderia suficiente para devolver.",
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        await requireDistributorStock(tx, companyId, id);
        const reserved = await tx.distributorBalance.updateMany({
          where: { distributorId: id, balanceQuantity: { gte: totalQuantity } },
          data: {
            returnedQuantity: { increment: totalQuantity },
            balanceQuantity: { decrement: totalQuantity },
          },
        });
        if (reserved.count !== 1)
          throw new BadRequestException("El saldo del distribuidor cambió");
        for (const item of items) {
          await debitDistributorStock(
            tx,
            id,
            item.productId,
            new Prisma.Decimal(item.quantity),
          );
          await tx.product.updateMany({
            where: { id: item.productId, companyId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        for (const item of items) {
          const product = productMap.get(item.productId)!;
          const movement = await tx.inventoryMovement.create({
            data: {
              companyId,
              productId: item.productId,
              distributorId: distributor.id,
              type: "RETURN",
              quantity: item.quantity,
              notes: dto.notes ?? "Devolucion de distribuidor",
            },
          });
          await tx.productBatch.create({
            data: {
              companyId,
              productId: item.productId,
              batchNumber: `DIST-RETURN-${movement.id}`,
              quantityReceived: item.quantity,
              quantityAvailable: item.quantity,
              purchasePrice: product.costPrice ?? 0,
              expirationDate: product.expiryDate,
            },
          });
          await this.kardexService.recordInMovement(
            companyId,
            item.productId,
            new Prisma.Decimal(item.quantity),
            product.costPrice ?? new Prisma.Decimal(0),
            movement.id,
            tx,
          );
        }

        const balance = await tx.distributorBalance.findUnique({
          where: { distributorId: id },
        });

        return { balance };
      },
      { maxWait: 10_000, timeout: 15_000 },
    );

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "Distributor",
      entityId: distributor.id,
      changes: { operation: "RETURN", items, totalQuantity },
    });

    return result;
  }

  async findSales(companyId: string, id: string) {
    await this.getDistributorOrFail(companyId, id);
    return this.prisma.sale.findMany({
      where: { companyId, distributorId: id },
      include: {
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async registerSale(
    companyId: string,
    id: string,
    dto: RegisterDistributorSaleDto,
    actor: SalesActor,
  ) {
    if (!canReadCompanySales(actor))
      throw new ForbiddenException(
        "No puedes registrar ventas de distribuidores",
      );
    saleAmounts(new Prisma.Decimal(0), dto.taxAmount);
    const distributor = await this.getDistributorOrFail(companyId, id);
    if (distributor.status !== "ACTIVE")
      throw new BadRequestException("El distribuidor no está activo");
    if (
      dto.customerId &&
      !(await this.prisma.customer.findFirst({
        where: { id: dto.customerId, companyId, deletedAt: null },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Cliente no encontrado");

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      include: { presentations: true },
    });
    const saleItems = resolveSaleLines(products, dto.items, true);
    const totalQuantity = saleItems.reduce(
      (sum, item) => sum.plus(item.baseQuantity),
      new Prisma.Decimal(0),
    );

    const balanceQuantity = distributor.balance?.balanceQuantity ?? 0;
    if (new Prisma.Decimal(balanceQuantity).lt(totalQuantity)) {
      throw new BadRequestException(
        "El distribuidor no tiene mercaderia suficiente para reportar esa venta.",
      );
    }

    let subtotal = new Prisma.Decimal(0);
    const itemsData = saleItems.map((item) => {
      subtotal = subtotal.plus(item.totalPrice);
      return {
        productId: item.productId,
        presentationId: item.presentationId,
        baseQuantity: item.baseQuantity,
        unitFactor: item.unitFactor,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      };
    });

    const { taxAmount, discountAmount, totalAmount } = saleAmounts(
      subtotal,
      dto.taxAmount,
      dto.discountAmount,
    );
    if (discountAmount.gt(0)) {
      const capabilities =
        await this.planCapabilities.getCapabilities(companyId);
      if (!this.planCapabilities.hasFeature(capabilities, "sales.discounts"))
        throw new ForbiddenException("El plan no incluye descuentos");
    }
    const saleNumber = `SALE-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const sale = await this.prisma.$transaction(
      async (tx) => {
        await requireDistributorStock(tx, companyId, id);
        for (const item of saleItems)
          await debitDistributorStock(
            tx,
            id,
            item.productId,
            item.baseQuantity,
          );
        const balance = await tx.distributorBalance.updateMany({
          where: {
            distributorId: distributor.id,
            balanceQuantity: { gte: totalQuantity },
          },
          data: {
            soldQuantity: { increment: totalQuantity },
            balanceQuantity: { decrement: totalQuantity },
          },
        });
        if (balance.count !== 1)
          throw new BadRequestException(
            "El distribuidor no tiene mercadería suficiente",
          );
        const created = await tx.sale.create({
          data: {
            companyId,
            customerId: dto.customerId,
            sellerId: actor.userId,
            distributorId: distributor.id,
            channel: "DISTRIBUTOR",
            saleNumber,
            subtotal,
            taxAmount,
            discountAmount,
            totalAmount,
            paymentMethod: dto.paymentMethod,
            paidAmount: totalAmount,
            changeAmount: 0,
            items: { create: itemsData },
          },
          include: { items: true },
        });

        await enqueueDomainEffect(tx, "SALE_COMMITTED", created.id);
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
        distributorId: distributor.id,
        channel: "DISTRIBUTOR",
        totalAmount: Number(sale.totalAmount),
        items: itemsData,
      },
    });

    return sale;
  }

  findDeliveries(companyId: string, id: string) {
    return this.prisma.distributorDelivery.findMany({
      where: { companyId, distributorId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async createDelivery(
    companyId: string,
    id: string,
    dto: CreateDistributorDeliveryDto,
  ) {
    await this.getDistributorOrFail(companyId, id);

    const delivery = await this.prisma.distributorDelivery.create({
      data: {
        companyId,
        distributorId: id,
        deliveryNumber: `DEL-${Date.now()}`,
        status: dto.status ?? "PENDING",
        deliveryDate: new Date(),
        amount: dto.amount,
        items: dto.items as unknown as Prisma.InputJsonValue,
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.CREATE,
      entity: "DistributorDelivery",
      entityId: delivery.id,
      changes: { distributorId: id, deliveryNumber: delivery.deliveryNumber },
    });

    return delivery;
  }

  async settle(
    companyId: string,
    id: string,
    dto: SettleDistributorDto,
    userId?: string,
  ) {
    const distributor = await this.getDistributorOrFail(companyId, id);
    const amount = new Prisma.Decimal(dto.amount);

    const balance = await this.prisma.$transaction(async (tx) => {
      const current = await tx.distributorBalance.findUnique({
        where: { distributorId: distributor.id },
        select: { debtAmount: true },
      });
      if (!current) {
        throw new BadRequestException(
          "El distribuidor no tiene saldo registrado.",
        );
      }

      const debt = current.debtAmount ?? new Prisma.Decimal(0);
      if (amount.gt(debt)) {
        throw new BadRequestException("El monto excede la deuda pendiente.");
      }

      const claimed = await tx.distributorBalance.updateMany({
        where: { distributorId: id, debtAmount: { gte: amount } },
        data: { debtAmount: { decrement: amount } },
      });
      if (claimed.count !== 1)
        throw new BadRequestException("La deuda cambió; actualiza el saldo");
      const updated = await tx.distributorBalance.findUnique({
        where: { distributorId: id },
      });

      await tx.financeRecord.create({
        data: {
          companyId,
          direction: "ENTRY",
          category: "SALE",
          description: `Liquidación de distribuidor ${distributor.name} (${distributor.code})`,
          amount,
          recordDate: new Date(),
          reference: distributor.code,
          notes: dto.notes,
          createdById: userId,
        },
      });

      return updated;
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.UPDATE,
      entity: "Distributor",
      entityId: distributor.id,
      changes: {
        operation: "SETTLEMENT",
        amount: Number(amount),
        notes: dto.notes,
      },
    });

    return balance;
  }
}
