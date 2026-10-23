import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  NotificationsService,
  CreateNotificationInput,
} from "@/modules/notifications/notifications.service";
import { SubscriptionAlertsService } from "./subscription-alerts.service";

describe("Subscription lifecycle alerts", () => {
  it("alerts company admins and super admins once per expiry event, including non-renewing plans", async () => {
    const delivered: CreateNotificationInput[] = [];
    const endDate = new Date(Date.now() + 86400000);
    let query: { where: { autoRenew?: boolean } } | undefined;
    const prisma = {
      subscription: {
        findMany: async (input: typeof query) => {
          query = input;
          return [
            {
              id: "sub",
              companyId: "company",
              endDate,
              plan: { name: "Pro" },
              company: { name: "Empresa", memberships: [{ userId: "owner" }] },
            },
          ];
        },
      },
      user: { findMany: async () => [{ id: "super" }] },
      notification: {
        findFirst: async ({
          where,
        }: {
          where: { userId: string; data: { equals: string } };
        }) =>
          delivered.find(
            (entry) =>
              entry.userId === where.userId &&
              entry.data?.subscriptionAlertKey === where.data.equals,
          ) ?? null,
      },
    };
    const notifications = {
      create: async (input: CreateNotificationInput) => {
        delivered.push(input);
        return input;
      },
    };
    const service = new SubscriptionAlertsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    await service.notifyLifecycle();
    await service.notifyLifecycle();
    assert.equal(query?.where.autoRenew, undefined);
    assert.equal(delivered.length, 2);
    assert.equal(
      delivered.find((entry) => entry.userId === "super")?.scope,
      "PLATFORM",
    );
    assert.equal(
      delivered.find((entry) => entry.userId === "owner")?.actionUrl,
      "/subscription",
    );
  });
});
