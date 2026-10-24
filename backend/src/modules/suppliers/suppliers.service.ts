import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { supplierReceipt } from "./supplier-receipt.helper";
import { AuditService } from "@/common/services/audit.service";
import { StockEntriesService } from "@/modules/stock-entries/stock-entries.service";
import {
  CreateSupplierDto,
  CreateSupplierOrderDto,
  QuerySupplierOrdersDto,
  QuerySuppliersDto,
  ReceiveSupplierOrderDto,
  SetSupplierProductsDto,
  UpdateSupplierDto,
  UpdateSupplierOrderStatusDto,
} from "./dto/supplier.dto";

const SUPPLIER_PRODUCTS_INCLUDE = {
  products: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          baseUnit: true,
          stockQuantity: true,
          minStock: true,
        },
      },
    },
  },
} satisfies Prisma.SupplierInclude;

const ORDER_INCLUDE = {
  supplier: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  items: {
    include: {
      product: {
        select: { id: true, name: true, sku: true, baseUnit: true },
      },
    },
  },
} satisfies Prisma.SupplierOrderInclude;

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly stockEntriesService: StockEntriesService,
  ) {}

  async findAll(companyId: string, query: QuerySuppliersDto) {
    const where: Prisma.SupplierWhereInput = { companyId, deletedAt: null };

    if (query.isActive === "true") where.isActive = true;
    if (query.isActive === "false") where.isActive = false;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { code: { contains: query.search, mode: "insensitive" } },
        { contactName: { contains: query.search, mode: "insensitive" } },
        { documentValue: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      include: SUPPLIER_PRODUCTS_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
      include: SUPPLIER_PRODUCTS_INCLUDE,
    });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado.");
    return supplier;
  }

  async create(companyId: string, userId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { companyId, name: dto.name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Ya existe un proveedor con ese nombre.");
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        documentType: dto.documentType,
        documentValue: dto.documentValue,
        brands: dto.brands ?? [],
        leadTimeDays: dto.leadTimeDays,
        paymentTerms: dto.paymentTerms,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
      },
      include: SUPPLIER_PRODUCTS_INCLUDE,
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "Supplier",
      entityId: supplier.id,
      changes: { name: supplier.name, code: supplier.code },
    });

    return supplier;
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateSupplierDto,
  ) {
    await this.findOne(companyId, id);

    if (dto.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { companyId, name: dto.name, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException("Ya existe un proveedor con ese nombre.");
      }
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        documentType: dto.documentType,
        documentValue: dto.documentValue,
        brands: dto.brands,
        leadTimeDays: dto.leadTimeDays,
        paymentTerms: dto.paymentTerms,
        notes: dto.notes,
        isActive: dto.isActive,
      },
      include: SUPPLIER_PRODUCTS_INCLUDE,
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.UPDATE,
      entity: "Supplier",
      entityId: supplier.id,
      changes: { ...dto },
    });

    return supplier;
  }

  async remove(companyId: string, userId: string, id: string) {
    await this.findOne(companyId, id);

    const openOrders = await this.prisma.supplierOrder.count({
      where: { companyId, supplierId: id, status: { in: ["DRAFT", "SENT"] } },
    });
    if (openOrders > 0) {
      throw new BadRequestException(
        "No se puede eliminar un proveedor con órdenes pendientes.",
      );
    }

    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.DELETE,
      entity: "Supplier",
      entityId: id,
    });

    return { ok: true };
  }

  async setProducts(
    companyId: string,
    userId: string,
    supplierId: string,
    dto: SetSupplierProductsDto,
  ) {
    await this.findOne(companyId, supplierId);

    const productIds = Array.from(
      new Set(dto.items.map((item) => item.productId)),
    );
    if (productIds.length !== dto.items.length) throw new BadRequestException("No repitas productos en la orden");
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException("Algún producto no existe en la empresa.");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierProduct.deleteMany({
        where: { companyId, supplierId },
      });

      for (const item of dto.items) {
        if (item.isPreferred) {
          await tx.supplierProduct.updateMany({
            where: { companyId, productId: item.productId },
            data: { isPreferred: false },
          });
        }
        await tx.supplierProduct.create({
          data: {
            companyId,
            supplierId,
            productId: item.productId,
            isPreferred: item.isPreferred ?? false,
            minOrderQuantity: item.minOrderQuantity ?? 1,
            supplierSku: item.supplierSku,
          },
        });
      }
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.UPDATE,
      entity: "SupplierProduct",
      entityId: supplierId,
      changes: { items: dto.items },
    });

    return this.findOne(companyId, supplierId);
  }

  async getAutoOrdersPreview(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        sku: true,
        baseUnit: true,
        stockQuantity: true,
        minStock: true,
        costPrice: true,
      },
    });

    const lowStock = products.filter(
      (product) => Number(product.stockQuantity) <= Number(product.minStock),
    );
    if (lowStock.length === 0) {
      return { groups: [], unassigned: [] };
    }

    const productIds = lowStock.map((product) => product.id);
    const links = await this.prisma.supplierProduct.findMany({
      where: { companyId, productId: { in: productIds } },
      include: {
        supplier: {
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
    });

    const linksByProduct = new Map<string, typeof links>();
    for (const link of links) {
      const list = linksByProduct.get(link.productId) ?? [];
      list.push(link);
      linksByProduct.set(link.productId, list);
    }

    type GroupItem = {
      productId: string;
      productName: string;
      sku: string | null;
      baseUnit: string;
      currentStock: number;
      minStock: number;
      missingUnits: number;
      suggestedQuantity: number;
      estimatedCost: number | null;
    };

    type Group = {
      supplier: { id: string; name: string; code: string | null };
      items: GroupItem[];
      estimatedTotal: number;
    };

    const groups = new Map<string, Group>();
    const unassigned: Array<{
      productId: string;
      productName: string;
      sku: string | null;
      currentStock: number;
      minStock: number;
    }> = [];

    for (const product of lowStock) {
      const productLinks = (linksByProduct.get(product.id) ?? []).filter(
        (link) => link.supplier.isActive,
      );
      const preferred =
        productLinks.find((link) => link.isPreferred) ?? productLinks[0];

      if (!preferred) {
        unassigned.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: Number(product.stockQuantity),
          minStock: Number(product.minStock),
        });
        continue;
      }

      const currentStock = Number(product.stockQuantity);
      const minStock = Number(product.minStock);
      const missingUnits = Math.max(minStock - currentStock, 1);
      const minOrderQuantity = Number(preferred.minOrderQuantity);
      const suggestedQuantity = Math.max(missingUnits, minOrderQuantity);
      const unitCost = product.costPrice ? Number(product.costPrice) : null;

      const group = groups.get(preferred.supplierId) ?? {
        supplier: {
          id: preferred.supplier.id,
          name: preferred.supplier.name,
          code: preferred.supplier.code,
        },
        items: [],
        estimatedTotal: 0,
      };

      const estimatedCost =
        unitCost === null ? null : unitCost * suggestedQuantity;
      group.items.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        baseUnit: product.baseUnit,
        currentStock,
        minStock,
        missingUnits,
        suggestedQuantity,
        estimatedCost,
      });
      if (estimatedCost !== null) {
        group.estimatedTotal += estimatedCost;
      }

      groups.set(preferred.supplierId, group);
    }

    return { groups: Array.from(groups.values()), unassigned };
  }

  async generateAutoOrders(companyId: string, userId: string) {
    const preview = await this.getAutoOrdersPreview(companyId);
    if (preview.groups.length === 0) {
      throw new BadRequestException(
        "No hay productos con stock bajo asignados a un proveedor.",
      );
    }

    const createdIds: string[] = [];

    for (const group of preview.groups) {
      const totalEstimated = group.items.reduce(
        (sum, item) => sum + (item.estimatedCost ?? 0),
        0,
      );

      const order = await this.prisma.supplierOrder.create({
        data: {
          companyId,
          supplierId: group.supplier.id,
          status: "DRAFT",
          isAutoGenerated: true,
          totalEstimated,
          createdById: userId,
          items: {
            create: group.items.map((item) => ({
              productId: item.productId,
              suggestedQuantity: item.suggestedQuantity,
              requestedQuantity: item.suggestedQuantity,
            })),
          },
        },
      });
      createdIds.push(order.id);
    }

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "SupplierOrder",
      entityId: createdIds.join(","),
      changes: { generated: createdIds.length, auto: true },
    });

    return this.findOrders(companyId, { status: "DRAFT" });
  }

  async findOrders(companyId: string, query: QuerySupplierOrdersDto) {
    const where: Prisma.SupplierOrderWhereInput = { companyId };
    if (query.status) where.status = query.status;
    if (query.supplierId) where.supplierId = query.supplierId;

    const orders = await this.prisma.supplierOrder.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async findOrder(companyId: string, id: string) {
    const order = await this.prisma.supplierOrder.findFirst({
      where: { id, companyId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException("Orden no encontrada.");
    return this.serializeOrder(order);
  }

  async createOrder(
    companyId: string,
    userId: string,
    dto: CreateSupplierOrderDto,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException("Proveedor no encontrado.");

    const productIds = Array.from(
      new Set(dto.items.map((item) => item.productId)),
    );
    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException("Algún producto no existe en la empresa.");
    }

    const totalEstimated = dto.items.reduce(
      (sum, item) => sum + (item.unitCost ?? 0) * item.requestedQuantity,
      0,
    );

    const order = await this.prisma.supplierOrder.create({
      data: {
        companyId,
        supplierId: dto.supplierId,
        reference: dto.reference,
        notes: dto.notes,
        status: "DRAFT",
        totalEstimated,
        createdById: userId,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            suggestedQuantity: item.requestedQuantity,
            requestedQuantity: item.requestedQuantity,
            unitCost: item.unitCost,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "SupplierOrder",
      entityId: order.id,
      changes: { supplierId: dto.supplierId, items: dto.items.length },
    });

    return this.serializeOrder(order);
  }

  async updateOrderStatus(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateSupplierOrderStatusDto,
  ) {
    return serializableTransaction(this.prisma, async (tx) => {
      const order = await tx.supplierOrder.findFirst({ where: { id, companyId }, include: ORDER_INCLUDE });
      if (!order) throw new NotFoundException("Orden no encontrada.");
      if (dto.status === order.status) return this.serializeOrder(order);
      if (dto.status === "CONFIRMED") throw new BadRequestException("La orden se confirma únicamente al recibir la mercadería");
      if (order.receivedAt || order.stockEntryId || order.status === "CONFIRMED" || order.status === "CANCELLED") throw new ConflictException("La orden ya está finalizada");
      if (!(dto.status === "CANCELLED" || (order.status === "DRAFT" && dto.status === "SENT"))) throw new BadRequestException("Transición de estado no permitida");
      const changed = await tx.supplierOrder.updateMany({ where: { id, companyId, status: order.status, receivedAt: null, stockEntryId: null }, data: { status: dto.status,
        ...(dto.status === "SENT" ? { sentAt: new Date() } : { cancelledAt: new Date() }) } });
      if (changed.count !== 1) throw new ConflictException("La orden cambió durante la operación");
      await this.auditService.log({ companyId, userId, action: AuditAction.UPDATE, entity: "SupplierOrder", entityId: id,
        changes: { from: order.status, to: dto.status, reason: dto.reason } }, tx);
      const updated = await tx.supplierOrder.findFirst({ where: { id, companyId }, include: ORDER_INCLUDE });
      if (!updated) throw new NotFoundException("Orden no encontrada.");
      return this.serializeOrder(updated);
    });
  }

  async receiveOrder(
    companyId: string,
    userId: string,
    id: string,
    dto: ReceiveSupplierOrderDto,
  ) {
    return serializableTransaction(this.prisma, async (tx) => {
      const order = await tx.supplierOrder.findFirst({ where: { id, companyId }, include: ORDER_INCLUDE });
      if (!order) throw new NotFoundException("Orden no encontrada.");
      if (order.status === "CANCELLED") throw new BadRequestException("La orden está cancelada.");
      const receipt = supplierReceipt(order, dto);
      if (order.receivedAt || order.stockEntryId || order.status === "CONFIRMED") {
        if (order.stockEntryId && order.receiptFingerprint === receipt.fingerprint) return { ...this.serializeOrder(order), alreadyReceived: true };
        throw new ConflictException("La orden ya fue confirmada o recibida y requiere conciliación si no tiene una entrada vinculada");
      }
      const claimed = await tx.supplierOrder.updateMany({ where: { id, companyId, status: { in: ["DRAFT", "SENT"] }, receivedAt: null, stockEntryId: null }, data: { status: "CONFIRMED", confirmedAt: new Date(), receivedAt: new Date() } });
      if (claimed.count !== 1) throw new ConflictException("La orden ya fue recibida o cancelada");
      const stockEntry = await this.stockEntriesService.createWithinTransaction(companyId, {
        supplierId: order.supplierId, branchId: dto.branchId, reference: receipt.reference, notes: receipt.notes,
        items: receipt.items.map((item) => ({ productId: item.productId, quantity: item.quantity.toNumber(), unitCost: item.unitCost.toNumber() })),
      }, tx, userId);
      await tx.supplierOrder.update({ where: { id }, data: { stockEntryId: stockEntry.id, receiptFingerprint: receipt.fingerprint } });
      for (const item of receipt.items) {
        const changed = await tx.supplierOrderItem.updateMany({ where: { orderId: id, productId: item.productId }, data: { unitCost: item.unitCost, receivedQuantity: item.quantity } });
        if (changed.count !== 1) throw new ConflictException("Las líneas de la orden cambiaron");
        await tx.supplierProduct.updateMany({ where: { companyId, productId: item.productId, supplierId: order.supplierId }, data: { lastCost: item.unitCost } });
      }
      await this.auditService.log({ companyId, userId, action: AuditAction.UPDATE, entity: "SupplierOrder", entityId: id,
        changes: { received: true, stockEntryId: stockEntry.id, fingerprint: receipt.fingerprint } }, tx);
      const updated = await tx.supplierOrder.findFirst({ where: { id, companyId }, include: ORDER_INCLUDE });
      if (!updated) throw new NotFoundException("Orden no encontrada.");
      return { ...this.serializeOrder(updated), alreadyReceived: false };
    }, { timeout: 60000 });
  }

  private serializeOrder<
    T extends { totalEstimated: Prisma.Decimal | null; items: unknown[] },
  >(order: T) {
    return {
      ...order,
      totalEstimated:
        order.totalEstimated === null ? null : Number(order.totalEstimated),
      items: (order.items as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        suggestedQuantity: Number(item.suggestedQuantity),
        requestedQuantity: Number(item.requestedQuantity),
        unitCost: item.unitCost === null ? null : Number(item.unitCost),
        receivedQuantity: Number(item.receivedQuantity ?? 0),
      })),
    };
  }
}
