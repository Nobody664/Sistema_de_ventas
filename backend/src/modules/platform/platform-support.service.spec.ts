import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { SupportChatService } from "@/modules/support/support-chat.service";
import { SupportTicketsService } from "@/modules/support/support-tickets.service";

describe("Platform support boundaries", () => {
  it("lists all companies' chats for platform agents without requiring participation", async () => {
    let where: unknown;
    const prisma = {
      supportConversation: {
        findMany: async (query: { where: unknown }) => {
          where = query.where;
          return [];
        },
        count: async () => 0,
      },
    };
    const service = new SupportChatService(
      prisma as unknown as PrismaService,
      {} as NotificationsService,
    );
    await service.findAll({ userId: "agent", isPlatform: true }, {});
    assert.deepEqual(where, {});
    await service.findAll(
      { userId: "agent", isPlatform: true },
      { assignment: "unassigned" },
    );
    assert.deepEqual(where, { assignedToId: null });
    await service.findAll(
      { userId: "agent", isPlatform: true },
      { assignment: "mine" },
    );
    assert.deepEqual(where, { assignedToId: "agent" });
  });

  it("keeps company chat listings scoped even when an assignment filter is supplied", async () => {
    let where: unknown;
    const prisma = {
      supportConversation: {
        findMany: async (query: { where: unknown }) => {
          where = query.where;
          return [];
        },
        count: async () => 0,
      },
    };
    const service = new SupportChatService(
      prisma as unknown as PrismaService,
      {} as NotificationsService,
    );
    await service.findAll(
      { userId: "company-admin", companyId: "company", isPlatform: false },
      { assignment: "all", companyId: "another-company" },
    );
    assert.deepEqual(where, { companyId: "company" });
  });

  it("prevents company users from assigning tickets", async () => {
    const service = new SupportTicketsService(
      {} as PrismaService,
      {} as NotificationsService,
    );
    await assert.rejects(
      service.assign(
        { userId: "user", companyId: "company", isPlatform: false },
        "ticket",
        { assignedToId: "agent" },
      ),
      ForbiddenException,
    );
  });

  it("rejects a non-platform assignee before changing a ticket", async () => {
    const prisma = {
      supportTicket: {
        findUnique: async () => ({ id: "ticket", companyId: "company" }),
      },
      user: {
        findUnique: async () => ({
          id: "user",
          globalRole: "USER",
          isActive: true,
        }),
      },
    };
    const service = new SupportTicketsService(
      prisma as unknown as PrismaService,
      {} as NotificationsService,
    );
    await assert.rejects(
      service.assign({ userId: "agent", isPlatform: true }, "ticket", {
        assignedToId: "user",
      }),
      BadRequestException,
    );
  });
});
