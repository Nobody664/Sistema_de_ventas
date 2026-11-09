import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { StoreAdminQueriesService } from "./store-admin-queries.service";

function row(id: string, createdAt: string) {
  return {
    id,
    number: `WEB-${id}`,
    status: "CONFIRMED",
    paymentStatus: "PAID",
    fulfillment: "UNFULFILLED",
    totalAmount: new Prisma.Decimal("25.00"),
    createdAt: new Date(createdAt),
    version: 2,
    refundRequestedAt: null,
    account: {
      customer: { firstName: "Ana", lastName: "Pérez", email: "ana@test.pe" },
    },
  };
}

function service(rows: unknown[]) {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    storeOrder: {
      count: async (args: Record<string, unknown>) => {
        calls.push(args);
        return 11;
      },
      findMany: async (args: Record<string, unknown>) => {
        calls.push(args);
        return rows;
      },
    },
  };
  return {
    queries: new StoreAdminQueriesService(prisma as never),
    calls,
  };
}

describe("StoreAdminQueriesService", () => {
  it("mantiene el envelope, el cursor opaco y el tenant", async () => {
    const { queries, calls } = service([
      row("order-3", "2026-11-08T12:00:00.000Z"),
      row("order-2", "2026-11-08T11:00:00.000Z"),
      row("order-1", "2026-11-08T10:00:00.000Z"),
    ]);
    const first = await queries.list("company", {
      q: "ana",
      status: "CONFIRMED",
      queue: "prepare",
      limit: 2,
    });
    assert.equal(first.data.length, 2);
    assert.deepEqual(first.pageInfo.hasMore, true);
    assert.equal(first.totals.matched, 11);
    assert.equal(first.data[0].customer.name, "Ana Pérez");
    assert.ok(first.pageInfo.nextCursor);

    const findMany = calls.find((call) => "take" in call) as {
      where: {
        companyId: string;
        AND: Array<Record<string, unknown>>;
      };
      take: number;
    };
    assert.equal(findMany.take, 3);
    assert.equal(findMany.where.companyId, "company");
    assert.deepEqual(findMany.where.AND[0].status, {
      in: ["PENDING_PAYMENT", "CONFIRMED"],
    });
    assert.equal(findMany.where.AND[0].fulfillment, "UNFULFILLED");
    assert.equal(findMany.where.AND[1].status, "CONFIRMED");
    const search = findMany.where.AND[2].OR as Array<Record<string, unknown>>;
    assert.deepEqual(search[0], {
      number: { contains: "ana", mode: "insensitive" },
    });
    assert.deepEqual(search[1], {
      paymentReference: { contains: "ana", mode: "insensitive" },
    });
    assert.deepEqual((search[2].account as { customer: unknown }).customer, {
      firstName: { contains: "ana", mode: "insensitive" },
    });

    await queries.list("company", {
      q: "ana",
      status: "CONFIRMED",
      queue: "prepare",
      limit: 2,
      cursor: first.pageInfo.nextCursor!,
    });
    const second = calls.filter((call) => "take" in call).at(-1) as {
      where: { AND: Array<Record<string, unknown>> };
    };
    const cursorCondition = second.where.AND.at(-1) as {
      OR: Array<Record<string, unknown>>;
    };
    assert.deepEqual(cursorCondition.OR[0], {
      createdAt: { lt: new Date("2026-11-08T11:00:00.000Z") },
    });
    assert.deepEqual(cursorCondition.OR[1], {
      createdAt: new Date("2026-11-08T11:00:00.000Z"),
      id: { lt: "order-2" },
    });
  });

  it("rechaza cursores de otra empresa o de otros filtros", async () => {
    const { queries } = service([
      row("order-2", "2026-11-08T11:00:00.000Z"),
      row("order-1", "2026-11-08T10:00:00.000Z"),
    ]);
    const first = await queries.list("company", {
      status: "CONFIRMED",
      limit: 1,
    });
    assert.ok(first.pageInfo.nextCursor);
    await assert.rejects(
      () =>
        queries.list("company", {
          status: "CONFIRMED",
          limit: 1,
          cursor: first.pageInfo.nextCursor!,
          q: "otro",
        }),
      BadRequestException,
    );
    await assert.rejects(
      () =>
        queries.list("other-company", {
          status: "CONFIRMED",
          limit: 1,
          cursor: first.pageInfo.nextCursor!,
        }),
      BadRequestException,
    );
  });
});
