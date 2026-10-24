import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { creditAmounts } from "./credit-note-amounts.helper";
import {
  CreateCreditNoteDto,
  QueryCreditNotesDto,
} from "./dto/credit-note.dto";

const CREDIT_NOTE_INCLUDE = {
  sale: { select: { id: true, saleNumber: true, totalAmount: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  items: true,
} satisfies Prisma.CreditNoteInclude;

@Injectable()
export class CreditNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(companyId: string, query: QueryCreditNotesDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const where: Prisma.CreditNoteWhereInput = { companyId };
    if (query.saleId) where.saleId = query.saleId;
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.creditNote.findMany({
        where,
        include: CREDIT_NOTE_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.creditNote.count({ where }),
    ]);

    return {
      data: data.map((note) => this.serialize(note)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(companyId: string, id: string) {
    const note = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      include: CREDIT_NOTE_INCLUDE,
    });
    if (!note) throw new NotFoundException("Nota de crédito no encontrada.");
    return this.serialize(note);
  }

  async create(
    companyId: string,
    userId: string | undefined,
    dto: CreateCreditNoteDto,
  ) {
    return serializableTransaction(this.prisma, async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: dto.saleId, companyId },
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      });
      if (!sale) throw new NotFoundException("Venta no encontrada.");

      if (sale.status !== "COMPLETED")
        throw new BadRequestException(
          "La venta ya no admite nuevas notas manuales",
        );
      const note = await this.buildNote(tx, companyId, userId, {
        sale,
        type: dto.type ?? "CREDIT",
        reason: dto.reason ?? "DISCOUNT",
        description: dto.description,
        items: dto.items,
      });

      await this.auditService.log(
        {
          companyId,
          userId,
          action: AuditAction.CREATE,
          entity: "CreditNote",
          entityId: note.id,
          changes: {
            noteNumber: note.noteNumber,
            saleId: sale.id,
            type: note.type,
            totalAmount: Number(note.totalAmount),
          },
        },
        tx,
      );
      return this.serialize(note);
    });
  }

  async createFromRefund(
    companyId: string,
    userId: string | undefined,
    saleId: string,
    reason?: string,
  ) {
    return serializableTransaction(this.prisma, async (tx) => {
      const note = await this.createFromRefundWithinTransaction(
        tx,
        companyId,
        userId,
        saleId,
        reason,
      );
      return note ? this.serialize(note) : null;
    });
  }

  async createFromRefundWithinTransaction(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string | undefined,
    saleId: string,
    reason?: string,
  ) {
    const existing = await tx.creditNote.findFirst({
      where: { companyId, operationKey: `reversal-${saleId}` },
      include: CREDIT_NOTE_INCLUDE,
    });
    if (existing) {
      return existing;
    }

    const sale = await tx.sale.findFirst({
      where: { id: saleId, companyId },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!sale) throw new NotFoundException("Venta no encontrada.");
    if (!["REFUNDED", "CANCELLED"].includes(sale.status))
      throw new BadRequestException(
        "La devolución debe confirmarse en la misma transacción que su nota",
      );

    const credited = await tx.creditNote.aggregate({
      where: {
        companyId,
        saleId,
        type: "CREDIT",
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true },
    });
    if (
      (credited._sum.totalAmount ?? new Prisma.Decimal(0)).gte(sale.totalAmount)
    )
      return null;
    const note = await this.buildNote(tx, companyId, userId, {
      sale,
      type: "CREDIT",
      reason: sale.status === "REFUNDED" ? "RETURN" : "CORRECTION",
      fullRefund: true,
      description: reason
        ? `Nota de crédito por devolución: ${reason}`
        : "Nota de crédito por devolución",
      items: undefined,
    });

    await this.auditService.log(
      {
        companyId,
        userId,
        action: AuditAction.CREATE,
        entity: "CreditNote",
        entityId: note.id,
        changes: {
          noteNumber: note.noteNumber,
          saleId,
          reason: "RETURN",
          totalAmount: Number(note.totalAmount),
        },
      },
      tx,
    );
    return note;
  }

  async updateStatus(
    companyId: string,
    userId: string | undefined,
    id: string,
    status: "ISSUED" | "APPLIED" | "CANCELLED",
  ) {
    const note = await this.prisma.creditNote.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, operationKey: true },
    });
    if (!note) throw new NotFoundException("Nota de crédito no encontrada.");
    if (note.status === "CANCELLED") {
      throw new BadRequestException("La nota ya está anulada.");
    }
    if (note.operationKey && status === "CANCELLED")
      throw new BadRequestException(
        "Una nota de devolución confirmada no puede anularse sin revertir el proceso completo",
      );

    const changed = await this.prisma.creditNote.updateMany({
      where: { id, companyId, status: note.status },
      data: { status },
    });
    if (changed.count !== 1)
      throw new ConflictException("La nota cambió durante la operación");

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.UPDATE,
      entity: "CreditNote",
      entityId: id,
      changes: { from: note.status, to: status },
    });

    return this.findOne(companyId, id);
  }

  private async buildNote(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string | undefined,
    input: {
      sale: {
        id: string;
        saleNumber: string;
        subtotal: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        totalAmount: Prisma.Decimal;
        discountAmount?: Prisma.Decimal | null;
        items: Array<{
          productId: string;
          product: { name: string };
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          totalPrice: Prisma.Decimal;
        }>;
      };
      type: "CREDIT" | "DEBIT";
      reason: "RETURN" | "DISCOUNT" | "CORRECTION" | "OTHER";
      description?: string;
      fullRefund?: boolean;
      items?: Array<{
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    const noteNumber = this.generateNoteNumber(input.type);

    let subtotal = new Prisma.Decimal(0);
    let itemsData: Array<{
      productId?: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }>;

    if (input.items && input.items.length > 0) {
      itemsData = input.items.map((item) => {
        const quantity = new Prisma.Decimal(item.quantity);
        const unitPrice = new Prisma.Decimal(item.unitPrice);
        const totalPrice = quantity.mul(unitPrice);
        if (
          !quantity.isFinite() ||
          quantity.lte(0) ||
          !unitPrice.isFinite() ||
          unitPrice.isNegative()
        )
          throw new BadRequestException("Cantidad o precio inválido");
        if (
          item.productId &&
          !input.sale.items.some((line) => line.productId === item.productId)
        )
          throw new BadRequestException(
            "El producto no pertenece a la venta original",
          );
        subtotal = subtotal.plus(totalPrice);
        return {
          productId: item.productId,
          description: item.description,
          quantity,
          unitPrice,
          totalPrice,
        };
      });
    } else {
      itemsData = input.sale.items.map((item) => {
        subtotal = subtotal.plus(item.totalPrice);
        return {
          productId: item.productId,
          description: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        };
      });
    }

    const previous = await tx.creditNote.aggregate({
      where: {
        companyId,
        saleId: input.sale.id,
        type: "CREDIT",
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true, taxAmount: true },
    });
    const amounts = creditAmounts(
      input.sale,
      subtotal,
      {
        total: previous._sum.totalAmount ?? new Prisma.Decimal(0),
        tax: previous._sum.taxAmount ?? new Prisma.Decimal(0),
      },
      Boolean(input.fullRefund),
      input.type === "CREDIT",
    );
    if (amounts.totalAmount.lte(0))
      throw new BadRequestException(
        "La nota debe representar un importe positivo",
      );
    const raw = subtotal;
    let allocated = new Prisma.Decimal(0);
    itemsData = itemsData.map((item, index) => {
      if (!item.quantity.isFinite() || item.quantity.lte(0))
        throw new BadRequestException("Cantidad histórica inválida");
      const amount =
        index === itemsData.length - 1
          ? amounts.subtotal.minus(allocated)
          : raw.gt(0)
            ? amounts.subtotal.mul(item.totalPrice).div(raw).toDecimalPlaces(2)
            : new Prisma.Decimal(0);
      allocated = allocated.plus(amount);
      return {
        ...item,
        totalPrice: amount,
        unitPrice: amount.div(item.quantity).toDecimalPlaces(4),
      };
    });

    return tx.creditNote.create({
      data: {
        companyId,
        saleId: input.sale.id,
        noteNumber,
        operationKey: input.fullRefund ? `reversal-${input.sale.id}` : null,
        type: input.type,
        reason: input.reason,
        status: "ISSUED",
        ...amounts,
        description: input.description,
        createdById: userId,
        items: { create: itemsData },
      },
      include: CREDIT_NOTE_INCLUDE,
    });
  }

  private generateNoteNumber(type: "CREDIT" | "DEBIT"): string {
    const prefix = type === "DEBIT" ? "ND" : "NC";
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private serialize<
    T extends {
      subtotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      totalAmount: Prisma.Decimal;
      items: unknown[];
    },
  >(note: T) {
    return {
      ...note,
      subtotal: Number(note.subtotal),
      taxAmount: Number(note.taxAmount),
      totalAmount: Number(note.totalAmount),
      items: (note.items as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
    };
  }
}
