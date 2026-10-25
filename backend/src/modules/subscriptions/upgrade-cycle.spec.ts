import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanUpgradeRequestsService } from "./plan-upgrade-requests.service";
import { PlatformAdminsService } from "@/modules/platform/platform-admins.service";
import { EntityIdPipe } from "@/common/pipes/entity-id.pipe";

describe("Upgrade contract and public admin responses", () => {
  it("approves the stored yearly cycle, not the plan's current monthly cycle, with a paidAt timestamp", async () => {
    let update: { billingCycle: string; endDate: Date } | undefined;
    let paidAt: Date | undefined;
    const request = {
      id: "request",
      companyId: "company",
      planId: "pro",
      amount: "100",
      currency: "PEN",
      billingCycle: "YEARLY",
      status: "PENDING",
      paymentDate: new Date("2026-10-01"),
      plan: { code: "FREE", name: "Pro" },
      company: { name: "Company", memberships: [] },
    };
    const tx = {
      outboxEvent: { upsert: async () => ({}) },
      planUpgradeRequest: {
        findUnique: async () => request,
        updateMany: async () => ({ count: 1 }),
      },
      subscription: {
        findUnique: async () => ({ id: "sub" }),
        update: async ({
          data,
        }: {
          data: { billingCycle: string; endDate: Date };
        }) => {
          update = data;
          return { id: "sub" };
        },
      },
      company: { update: async () => ({}) },
      plan: { findUnique: async () => ({ billingCycle: "MONTHLY" }) },
      payment: {
        create: async ({ data }: { data: { paidAt: Date } }) => {
          paidAt = data.paidAt;
        },
      },
    };
    const prisma = {
      planUpgradeRequest: { findUnique: async () => request },
      $transaction: async <T>(work: (client: typeof tx) => Promise<T>) =>
        work(tx),
    } as unknown as PrismaService;
    const service = new PlanUpgradeRequestsService(
      prisma,
      {} as never,
      { notifySuperAdmins: async () => ({}) } as never,
      { invalidate: async () => undefined } as never,
    );
    const before = new Date();
    await service.review("request", "admin", { status: "APPROVED" });
    assert.equal(update?.billingCycle, "YEARLY");
    assert.ok(update!.endDate.getTime() - before.getTime() > 360 * 86400000);
    assert.equal(paidAt?.toISOString(), request.paymentDate.toISOString());
    request.billingCycle = null as unknown as string;
    await assert.rejects(
      service.review("request", "admin", { status: "APPROVED" }),
      ConflictException,
    );
  });
  it("accepts opaque CUID identifiers and rejects injected path syntax", () => {
    const pipe = new EntityIdPipe();
    assert.equal(pipe.transform("clx1234567890abcdef"), "clx1234567890abcdef");
    assert.throws(() => pipe.transform("../admin?execute=sql"));
  });
  it("projects administrators on both no-op and mutation response branches", async () => {
    const select = {
      id: true,
      email: true,
      fullName: true,
      globalRole: true,
      isActive: true,
      createdAt: true,
    };
    const prisma = {
      user: {
        findUnique: async (args: { select: unknown }) => {
          assert.deepEqual(args.select, select);
          return { id: "user", globalRole: "SUPPORT_ADMIN" };
        },
        update: async (args: { select: unknown }) => {
          assert.deepEqual(args.select, select);
          return { id: "user", globalRole: "USER" };
        },
      },
    } as unknown as PrismaService;
    const service = new PlatformAdminsService(prisma);
    assert.equal(
      "passwordHash" in (await service.grantSupportAdmin("user")),
      false,
    );
    assert.equal(
      "passwordHash" in (await service.revokeAdmin("user", "another-admin")),
      false,
    );
  });
});
