import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PrismaService } from "@/database/prisma/prisma.service";
import { SupportChatService } from "./support-chat.service";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { CreateCheckoutSessionDto } from "@/modules/payments/dto/payment-query.dto";

describe("Bounded query contracts and message cursors", () => {
  it("rejects zero, negative and oversized query pages at DTO validation", async () => {
    for (const input of [
      { page: "0" },
      { limit: "101" },
      { page: "-1" },
      { page: "nan" },
      { limit: null },
    ])
      assert.ok(
        (await validate(plainToInstance(PaginationQueryDto, input))).length > 0,
      );
    assert.equal(
      (
        await validate(
          plainToInstance(PaginationQueryDto, { page: "2", limit: "50" }),
        )
      ).length,
      0,
    );
    assert.ok(
      (
        await validate(
          plainToInstance(CreateCheckoutSessionDto, { planCode: "../unsafe" }),
        )
      ).length > 0,
    );
  });
  it("returns bounded chronological pages with a deterministic cursor for equal timestamps", async () => {
    const date = new Date("2026-01-01");
    const rows = ["c", "b", "a"].map((id) => ({ id, createdAt: date }));
    let cursorWhere: unknown;
    const service = new SupportChatService(
      {
        supportConversation: {
          findUnique: async () => ({ companyId: "company", participants: [] }),
        },
        supportMessage: {
          findFirst: async ({
            where,
          }: {
            where: { id: string; conversationId: string };
          }) => {
            assert.equal(where.conversationId, "chat");
            return rows.find((row) => row.id === where.id);
          },
          findMany: async (query: {
            take: number;
            where: { OR?: unknown };
          }) => {
            assert.equal(query.take, 3);
            cursorWhere = query.where.OR;
            return query.where.OR ? [rows[2]] : rows;
          },
        },
      } as unknown as PrismaService,
      {} as never,
    );
    const actor = { userId: "user", companyId: "company", isPlatform: false };
    const first = await service.listMessages(actor, "chat", { limit: 2 });
    assert.deepEqual(
      first.items.map((row) => row.id),
      ["b", "c"],
    );
    assert.equal(first.nextCursor, "b");
    assert.equal(first.hasMore, true);
    const second = await service.listMessages(actor, "chat", {
      limit: 2,
      before: "b",
    });
    assert.deepEqual(
      second.items.map((row) => row.id),
      ["a"],
    );
    assert.equal(second.hasMore, false);
    assert.ok(cursorWhere);
    await assert.rejects(service.listMessages(actor, "chat", { limit: 101 }), {
      status: 400,
    });
  });
});
