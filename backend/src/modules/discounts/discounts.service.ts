import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AuditAction,
  DiscountType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuditService } from "@/common/services/audit.service";
import {
  CreateDiscountCouponDto,
  QueryDiscountCouponDto,
  UpdateDiscountCouponDto,
} from "./dto/discount.dto";

type PrismaTx = Omit<
  PrismaClient,
  "$on" | "$connect" | "$disconnect" | "$transaction" | "$use" | "$extends"
>;

export interface AppliedCoupon {
  couponId: string;
  code: string;
  type: DiscountType;
  value: number;
  discountAmount: Prisma.Decimal;
}

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    companyId: string,
    userId: string | undefined,
    input: CreateDiscountCouponDto,
  ) {
    const code = input.code.trim().toUpperCase();
    const startsAt = input.startsAt ? new Date(input.startsAt) : null;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    this.assertWindow(startsAt, expiresAt);
    this.assertValue(input.type ?? "PERCENTAGE", input.value);

    const existing = await this.prisma.discountCoupon.findFirst({
      where: { companyId, code },
    });
    if (existing) {
      throw new BadRequestException(
        `Ya existe un cupon con el codigo ${code}.`,
      );
    }

    const coupon = await this.prisma.discountCoupon.create({
      data: {
        companyId,
        code,
        description: input.description ?? null,
        type: input.type ?? "PERCENTAGE",
        value: new Prisma.Decimal(input.value),
        maxUses: input.maxUses ?? null,
        minPurchase:
          input.minPurchase !== null && input.minPurchase !== undefined
            ? new Prisma.Decimal(input.minPurchase)
            : null,
        startsAt,
        expiresAt,
        isActive: input.isActive ?? true,
        createdById: userId ?? null,
      },
    });

    await this.auditService.log({
      companyId,
      userId,
      action: AuditAction.CREATE,
      entity: "DiscountCoupon",
      entityId: coupon.id,
      changes: {
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        maxUses: coupon.maxUses,
      },
    });

    return coupon;
  }

  async findAll(companyId: string, query: QueryDiscountCouponDto) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const where: Prisma.DiscountCouponWhereInput = { companyId };
    if (query.isActive === "true") where.isActive = true;
    if (query.isActive === "false") where.isActive = false;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.discountCoupon.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.discountCoupon.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(companyId: string, id: string) {
    const coupon = await this.prisma.discountCoupon.findFirst({
      where: { id, companyId },
    });
    if (!coupon) {
      throw new NotFoundException("Cupon de descuento no encontrado.");
    }
    return coupon;
  }

  async update(companyId: string, id: string, input: UpdateDiscountCouponDto) {
    const existing = await this.findOne(companyId, id);

    const type = input.type ?? existing.type;
    const value = input.value ?? Number(existing.value);
    this.assertValue(type, value);
    const startsAt =
      input.startsAt === undefined
        ? existing.startsAt
        : input.startsAt
          ? new Date(input.startsAt)
          : null;
    const expiresAt =
      input.expiresAt === undefined
        ? existing.expiresAt
        : input.expiresAt
          ? new Date(input.expiresAt)
          : null;
    this.assertWindow(startsAt, expiresAt);

    let code: string | undefined;
    if (input.code) {
      code = input.code.trim().toUpperCase();
      if (code !== existing.code) {
        const clash = await this.prisma.discountCoupon.findFirst({
          where: { companyId, code },
        });
        if (clash) {
          throw new BadRequestException(
            `Ya existe un cupon con el codigo ${code}.`,
          );
        }
      }
    }

    const coupon = await this.prisma.discountCoupon.update({
      where: { id },
      data: {
        code,
        description:
          input.description === undefined ? undefined : input.description,
        type: input.type,
        value:
          input.value !== undefined
            ? new Prisma.Decimal(input.value)
            : undefined,
        maxUses: input.maxUses === undefined ? undefined : input.maxUses,
        minPurchase:
          input.minPurchase === undefined
            ? undefined
            : input.minPurchase !== null
              ? new Prisma.Decimal(input.minPurchase)
              : null,
        startsAt: input.startsAt === undefined ? undefined : startsAt,
        expiresAt: input.expiresAt === undefined ? undefined : expiresAt,
        isActive: input.isActive,
      },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.UPDATE,
      entity: "DiscountCoupon",
      entityId: coupon.id,
      changes: {
        before: { code: existing.code, isActive: existing.isActive },
        after: input,
      },
    });

    return coupon;
  }

  async remove(companyId: string, id: string) {
    const existing = await this.findOne(companyId, id);

    const coupon = await this.prisma.discountCoupon.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      companyId,
      action: AuditAction.DELETE,
      entity: "DiscountCoupon",
      entityId: id,
      changes: { code: existing.code, deactivated: true },
    });

    return coupon;
  }

  async validate(companyId: string, code: string, subtotal?: number) {
    const base = new Prisma.Decimal(subtotal ?? 0);
    const { coupon, discountAmount } = await this.evaluate(
      companyId,
      code,
      base,
    );

    return {
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        description: coupon.description,
      },
      discountAmount: Number(discountAmount),
      totalAfterDiscount: Number(base.minus(discountAmount)),
    };
  }

  async resolveForSale(
    tx: PrismaTx,
    companyId: string,
    code: string,
    subtotal: Prisma.Decimal,
  ): Promise<AppliedCoupon> {
    const { coupon, discountAmount } = await this.evaluate(
      companyId,
      code,
      subtotal,
      tx,
    );

    const consumed = await tx.discountCoupon.updateMany({
      where: {
        id: coupon.id,
        companyId,
        isActive: true,
        ...(coupon.maxUses !== null
          ? { usedCount: { lt: coupon.maxUses } }
          : {}),
      },
      data: { usedCount: { increment: 1 } },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException(
        "El cupon de descuento ya no tiene cupos disponibles.",
      );
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discountAmount,
    };
  }

  private async evaluate(
    companyId: string,
    rawCode: string,
    subtotal: Prisma.Decimal,
    client: PrismaService | PrismaTx = this.prisma,
  ) {
    const code = rawCode.trim().toUpperCase();
    const coupon = await client.discountCoupon.findFirst({
      where: { companyId, code },
    });
    const now = new Date();

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException("El cupon no existe o no esta activo.");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException("El cupon aun no esta vigente.");
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException("El cupon ha expirado.");
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException("El cupon ha alcanzado su limite de usos.");
    }
    if (coupon.minPurchase && subtotal.lt(coupon.minPurchase)) {
      throw new BadRequestException(
        `El cupon requiere una compra minima de ${Number(coupon.minPurchase)}.`,
      );
    }

    let discountAmount = new Prisma.Decimal(0);
    if (coupon.type === DiscountType.PERCENTAGE) {
      discountAmount = subtotal.mul(coupon.value).div(100);
    } else {
      discountAmount = coupon.value;
    }
    discountAmount = Prisma.Decimal.min(discountAmount, subtotal);
    discountAmount = discountAmount.toDecimalPlaces(2);

    return { coupon, discountAmount };
  }

  private assertValue(
    type: DiscountType | "PERCENTAGE" | "FIXED",
    value: number,
  ) {
    if (value <= 0) {
      throw new BadRequestException(
        "El valor del descuento debe ser mayor a 0.",
      );
    }
    if (type === "PERCENTAGE" && value > 100) {
      throw new BadRequestException(
        "El porcentaje de descuento no puede ser mayor a 100.",
      );
    }
  }

  private assertWindow(startsAt?: Date | null, expiresAt?: Date | null) {
    if (startsAt && expiresAt && startsAt > expiresAt) {
      throw new BadRequestException(
        "La fecha de inicio no puede ser posterior a la de expiracion.",
      );
    }
  }
}
