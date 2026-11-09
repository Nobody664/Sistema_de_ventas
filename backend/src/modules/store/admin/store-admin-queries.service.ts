import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, StoreOrderState } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  StoreAdminOrdersQueryDto,
  StoreAdminQueue,
} from "./dto/store-admin.dto";

const ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  paymentStatus: true,
  fulfillment: true,
  totalAmount: true,
  createdAt: true,
  version: true,
  refundRequestedAt: true,
  account: {
    select: {
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.StoreOrderSelect;

type OrderRow = Prisma.StoreOrderGetPayload<{ select: typeof ORDER_SELECT }>;

interface CursorPayload {
  companyId: string;
  createdAt: Date;
  id: string;
  filterKey: string;
}

export function storeAdminQueueWhere(
  queue: StoreAdminQueue,
  asOf: Date,
): Prisma.StoreOrderWhereInput {
  if (queue === "review")
    return {
      OR: [{ status: "REVIEW_REQUIRED" }, { paymentStatus: "UNDER_REVIEW" }],
    };
  if (queue === "prepare")
    return {
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      fulfillment: "UNFULFILLED",
      OR: [
        { paymentStatus: "PAID" },
        {
          snapshot: {
            path: ["payment", "code"],
            equals: "CASH_ON_PICKUP",
          },
          expiresAt: { gt: asOf },
        },
      ],
    };
  if (queue === "pickup")
    return {
      fulfillment: "READY_FOR_PICKUP",
      status: { notIn: ["CANCELLED", "EXPIRED"] },
    };
  if (queue === "preparing")
    return {
      fulfillment: "PREPARING",
      status: { notIn: ["CANCELLED", "EXPIRED", "COMPLETED"] },
    };
  return {
    fulfillment: "SHIPPED",
    status: { notIn: ["CANCELLED", "EXPIRED"] },
  };
}

@Injectable()
export class StoreAdminQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: StoreAdminOrdersQueryDto) {
    const asOf = new Date();
    const limit = query.limit ?? 30;
    const paymentStatus = query.paymentStatus?.toUpperCase();
    const filters = {
      ...(query.queue ? { queue: query.queue } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(query.fulfillment ? { fulfillment: query.fulfillment } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.shippingKind ? { shippingKind: query.shippingKind } : {}),
    };
    const filterKey = this.filterKey(filters);
    const conditions: Prisma.StoreOrderWhereInput[] = [];

    if (query.queue) conditions.push(storeAdminQueueWhere(query.queue, asOf));
    if (query.shippingKind)
      conditions.push({
        snapshot: { path: ["shipping", "kind"], equals: query.shippingKind },
      });
    if (query.status)
      conditions.push({ status: query.status as StoreOrderState });
    if (paymentStatus) conditions.push({ paymentStatus });
    if (query.fulfillment) conditions.push({ fulfillment: query.fulfillment });
    if (query.q) {
      const text = query.q;
      conditions.push({
        OR: [
          { number: { contains: text, mode: "insensitive" } },
          { paymentReference: { contains: text, mode: "insensitive" } },
          {
            account: {
              customer: {
                firstName: { contains: text, mode: "insensitive" },
              },
            },
          },
          {
            account: {
              customer: {
                lastName: { contains: text, mode: "insensitive" },
              },
            },
          },
          {
            account: {
              customer: {
                email: { contains: text, mode: "insensitive" },
              },
            },
          },
        ],
      });
    }

    const countWhere: Prisma.StoreOrderWhereInput = {
      companyId,
      ...(conditions.length ? { AND: [...conditions] } : {}),
    };
    const cursor = query.cursor
      ? this.decodeCursor(query.cursor, companyId, filterKey)
      : null;
    if (cursor) {
      conditions.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }

    const where: Prisma.StoreOrderWhereInput = {
      companyId,
      ...(conditions.length ? { AND: conditions } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.storeOrder.count({ where: countWhere }),
      this.prisma.storeOrder.findMany({
        where,
        select: ORDER_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
    ]);
    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const last = data.at(-1);

    return {
      data: data.map((order) => this.serialize(order)),
      pageInfo: {
        nextCursor:
          hasMore && last
            ? this.encodeCursor(companyId, last, filterKey)
            : null,
        hasMore,
      },
      totals: { matched: total },
      appliedFilters: filters,
      asOf: asOf.toISOString(),
    };
  }

  private serialize(order: OrderRow) {
    const customer = order.account.customer;
    const name = [customer.firstName, customer.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt.toISOString(),
      version: order.version,
      refundRequestedAt: order.refundRequestedAt?.toISOString() ?? null,
      customer: {
        name: name || null,
        email: customer.email ?? null,
      },
    };
  }

  private filterKey(filters: Record<string, string>): string {
    return createHash("sha256")
      .update(JSON.stringify(filters))
      .digest("base64url")
      .slice(0, 16);
  }

  private encodeCursor(
    companyId: string,
    order: Pick<OrderRow, "id" | "createdAt">,
    filterKey: string,
  ): string {
    return Buffer.from(
      JSON.stringify({
        c: companyId,
        t: order.createdAt.toISOString(),
        i: order.id,
        f: filterKey,
      }),
    ).toString("base64url");
  }

  private decodeCursor(
    value: string,
    companyId: string,
    filterKey: string,
  ): CursorPayload {
    try {
      const parsed = JSON.parse(
        Buffer.from(value, "base64url").toString("utf8"),
      ) as { c?: unknown; t?: unknown; i?: unknown; f?: unknown };
      if (
        parsed.c !== companyId ||
        parsed.f !== filterKey ||
        typeof parsed.t !== "string" ||
        typeof parsed.i !== "string" ||
        Number.isNaN(Date.parse(parsed.t))
      )
        throw new Error();
      return {
        companyId,
        createdAt: new Date(parsed.t),
        id: parsed.i,
        filterKey,
      };
    } catch {
      throw new BadRequestException("El cursor de pedidos no es válido");
    }
  }
}
