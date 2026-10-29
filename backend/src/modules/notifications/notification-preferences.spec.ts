import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

function fixture() {
  const membership = {
    isActive: true,
    notificationSales: true,
    notificationStock: true,
    notificationSound: true,
  };
  const state = { writes: 0, publishes: 0 };
  const prisma = {
    membership: {
      findUnique: async ({
        where,
      }: {
        where: { userId_companyId: { userId: string; companyId: string } };
      }) => {
        assert.deepEqual(where.userId_companyId, {
          userId: "owner",
          companyId: "company-a",
        });
        return membership;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        assert.deepEqual(where, {
          userId: "owner",
          companyId: "company-a",
          isActive: true,
        });
        for (const [key, value] of Object.entries(data))
          if (value !== undefined) Object.assign(membership, { [key]: value });
        return { count: 1 };
      },
    },
    notification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.writes++;
        return { id: "notice", ...data };
      },
    },
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);
  service.subscribe("owner", () => {
    state.publishes++;
  });
  const user = {
    sub: "owner",
    email: "owner@example.test",
    companyId: "company-a",
    roles: ["COMPANY_ADMIN"],
  };
  return { service, user, membership, state };
}

describe("Business notification preferences", () => {
  it("persists partial preferences only for the authenticated membership", async () => {
    const { service, user } = fixture();
    assert.deepEqual(
      await service.updatePreferences(user, { soundEnabled: false }),
      { salesEnabled: true, stockEnabled: true, soundEnabled: false },
    );
  });
  it("suppresses new optional sales and stock alerts but not payment notices", async () => {
    const { service, user, state } = fixture();
    await service.updatePreferences(user, {
      salesEnabled: false,
      stockEnabled: false,
    });
    const input = {
      companyId: user.companyId,
      userId: user.sub,
      title: "Aviso",
      message: "Mensaje",
    };
    assert.equal(await service.create({ ...input, type: "NEW_SALE" }), null);
    assert.equal(await service.create({ ...input, type: "LOW_STOCK" }), null);
    assert.equal(
      (await service.create({ ...input, type: "PAYMENT_RECEIVED" }))?.id,
      "notice",
    );
    assert.equal(state.writes, 1);
    assert.equal(state.publishes, 1);
  });
  it("does not send business alerts to an inactive membership", async () => {
    const { service, membership, state } = fixture();
    membership.isActive = false;
    assert.equal(
      await service.create({
        companyId: "company-a",
        userId: "owner",
        title: "Venta",
        message: "Texto",
        type: "NEW_SALE",
      }),
      null,
    );
    assert.equal(state.writes, 0);
  });
  it("keeps platform users outside tenant preference writes", async () => {
    const { service, user } = fixture();
    await assert.rejects(
      service.getPreferences({
        ...user,
        companyId: null,
        roles: ["SUPER_ADMIN"],
      }),
      ForbiddenException,
    );
  });
});
