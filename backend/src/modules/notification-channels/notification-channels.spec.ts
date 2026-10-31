import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import webPush from "web-push";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { EmailService } from "@/modules/email/email.service";
import { IntegrationOwnerService } from "@/modules/integrations/integration-owner.service";
import { IntegrationSecretsService } from "@/modules/integrations/integration-secrets.service";
import { DigestService, digestDay } from "./digest.service";
import { WebPushService, validPushEndpoint } from "./web-push.service";

describe("Optional notification channels", () => {
  for (const outcome of ["sent", "expired", "transferred"] as const) {
    it(`handles ${outcome} Web Push deliveries without disclosing business content or another account's notices`, async (context) => {
      const vapid = webPush.generateVAPIDKeys();
      const config = new ConfigService({
        INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        VAPID_PUBLIC_KEY: vapid.publicKey,
        VAPID_PRIVATE_KEY: vapid.privateKey,
        VAPID_SUBJECT: "mailto:admin@example.test",
      });
      const secrets = new IntegrationSecretsService(config);
      const updates: Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }> = [];
      let deleted = false;
      let sends = 0;
      context.mock.method(
        webPush,
        "sendNotification",
        async (_subscription: unknown, payload: string) => {
          sends++;
          const message = JSON.parse(payload);
          assert.deepEqual(message, {
            title: "New notification",
            body: "Open the system to view your notifications.",
            url: "/notifications",
            tag: "notice-a",
          });
          if (outcome === "expired")
            throw Object.assign(new Error("expired"), { statusCode: 410 });
          return { statusCode: 201 };
        },
      );
      const row = {
        id: "push-a",
        subscriptionId: "subscription-a",
        notificationId: "notice-a",
        attempts: 0,
        notification: {
          userId: "user-a",
          companyId: "company-a",
          isRead: false,
          createdAt: new Date(),
          title: "Confidential company data",
        },
        subscription: {
          encryptedSubscription: secrets.encrypt(
            JSON.stringify({
              endpoint: "https://fcm.googleapis.com/fcm/send/browser-token",
              keys: { p256dh: "fixture", auth: "fixture" },
            }),
          ),
          membership: {
            userId: outcome === "transferred" ? "user-b" : "user-a",
            companyId: "company-a",
            isActive: true,
            role: "COMPANY_ADMIN",
            locale: "en",
            user: { isActive: true },
            company: { status: "ACTIVE" },
          },
        },
      };
      const prisma = {
        notification: { findMany: async () => [] },
        pushDelivery: {
          findMany: async () => [row],
          updateMany: async (args: (typeof updates)[number]) => {
            updates.push(args);
            return { count: 1 };
          },
        },
        webPushSubscription: {
          deleteMany: async ({ where }: { where: unknown }) => {
            assert.deepEqual(where, { id: "subscription-a" });
            deleted = true;
          },
        },
      };
      const service = new WebPushService(
        prisma as unknown as PrismaService,
        {} as IntegrationOwnerService,
        secrets,
        config,
      );
      await service.process();
      assert.equal(sends, outcome === "transferred" ? 0 : 1);
      assert.equal(deleted, outcome === "expired");
      if (outcome !== "expired") {
        assert.equal(
          updates.at(-1)?.where.leaseToken,
          updates[0].data.leaseToken,
        );
        assert.ok(updates.at(-1)?.data.finishedAt instanceof Date);
      }
    });
  }
  it("schedules the tenant's previous-day snapshot and durable effect only once across repeated sweeps", async (context) => {
    context.mock.timers.enable({
      apis: ["Date"],
      now: new Date("2026-10-30T13:00:00Z"),
    });
    let delivery: Record<string, unknown> | null = null;
    let reads = 0;
    const effects = new Set<string>();
    const prisma = {
      membership: {
        findMany: async () => [
          {
            id: "member-a",
            companyId: "company-a",
            locale: "en",
            company: {
              name: "Business A",
              timezone: "America/Lima",
              currency: "PEN",
            },
          },
        ],
      },
      digestDelivery: {
        findUnique: async () => delivery,
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          delivery = { id: "digest-a", ...create };
          return delivery;
        },
      },
      sale: {
        aggregate: async ({ where }: { where: unknown }) => {
          reads++;
          assert.deepEqual(where, {
            companyId: "company-a",
            status: "COMPLETED",
            createdAt: {
              gte: new Date("2026-10-29T05:00:00Z"),
              lt: new Date("2026-10-30T05:00:00Z"),
            },
          });
          return {
            _count: { id: 2 },
            _sum: { totalAmount: new Prisma.Decimal("12.34") },
          };
        },
      },
      outboxEvent: {
        upsert: async ({ where }: { where: { dedupeKey: string } }) => {
          effects.add(where.dedupeKey);
        },
      },
      $transaction: async <T>(work: (tx: unknown) => Promise<T>) =>
        work(prisma),
    };
    const service = new DigestService(
      prisma as unknown as PrismaService,
      {} as IntegrationOwnerService,
      {} as EmailService,
      new ConfigService({ SMTP_ENABLED: true }),
    );
    try {
      await service.schedule();
      await service.schedule();
      assert.equal(reads, 1);
      assert.deepEqual([...effects], ["DAILY_DIGEST:digest-a"]);
      assert.match(String(delivery?.message), /Completed sales: 2.*12.34 PEN/);
      assert.equal(delivery?.locale, "en");
    } finally {
      context.mock.timers.reset();
    }
  });
  it("selects yesterday only from 08:00 in each business timezone including DST", () => {
    assert.equal(
      digestDay(new Date("2026-10-30T12:59:59Z"), "America/Lima"),
      null,
    );
    assert.equal(
      digestDay(new Date("2026-10-30T13:00:00Z"), "America/Lima"),
      "2026-10-29",
    );
    assert.equal(
      digestDay(new Date("2026-10-30T13:00:00Z"), "Asia/Tokyo"),
      "2026-10-29",
    );
    assert.equal(
      digestDay(new Date("2026-11-01T12:59:59Z"), "America/New_York"),
      null,
    );
    assert.equal(
      digestDay(new Date("2026-11-01T13:00:00Z"), "America/New_York"),
      "2026-10-31",
    );
  });
  it("does not claim success when SMTP is disabled and respects opt-out before sending", async () => {
    let sends = 0;
    let saved = 0;
    const row = {
      sentAt: null as Date | null,
      message: "summary",
      membership: {
        dailyDigestEnabled: true,
        isActive: true,
        role: "COMPANY_ADMIN",
        locale: "es",
        user: { email: "owner@example.test", isActive: true },
        company: { status: "ACTIVE" },
      },
    };
    const prisma = {
      digestDelivery: {
        findUniqueOrThrow: async () => row,
        update: async () => {
          saved++;
        },
      },
    };
    const email = {
      sendEmailDirect: async () => {
        sends++;
      },
    };
    const service = new DigestService(
      prisma as unknown as PrismaService,
      {} as IntegrationOwnerService,
      email as unknown as EmailService,
      new ConfigService({ SMTP_ENABLED: false }),
    );
    await assert.rejects(service.deliver("digest-a"));
    assert.equal(saved, 0);
    row.membership.dailyDigestEnabled = false;
    await service.deliver("digest-a");
    assert.equal(sends, 0);
  });
  it("sends in the recipient language with a stable Message-ID and persists confirmed delivery", async () => {
    const jobs: Array<{ messageId: string; subject: string }> = [];
    let saved = false;
    const prisma = {
      digestDelivery: {
        findUniqueOrThrow: async () => ({
          sentAt: null,
          message: "Business | Yesterday | 0.00 PEN",
          locale: "en",
          membership: {
            dailyDigestEnabled: true,
            isActive: true,
            role: "COMPANY_ADMIN",
            locale: "es",
            user: { email: "owner@example.test", isActive: true },
            company: { status: "ACTIVE" },
          },
        }),
        update: async () => {
          saved = true;
        },
      },
    };
    const service = new DigestService(
      prisma as unknown as PrismaService,
      {} as IntegrationOwnerService,
      {
        sendEmailDirect: async (job: (typeof jobs)[number]) => {
          jobs.push(job);
        },
      } as unknown as EmailService,
      new ConfigService({ SMTP_ENABLED: true }),
    );
    await service.deliver("digest-a");
    assert.equal(jobs[0].subject, "Daily business summary");
    assert.equal(jobs[0].messageId, "<digest-digest-a@notifications.ventas>");
    assert.equal(saved, true);
  });
  it("accepts only known push services rather than arbitrary outbound URLs", () => {
    assert.equal(
      validPushEndpoint("https://fcm.googleapis.com/fcm/send/browser-token"),
      true,
    );
    for (const value of [
      "http://fcm.googleapis.com/a",
      "https://fcm.googleapis.com.evil.test/a",
      "https://127.0.0.1/a",
      "https://updates.push.services.mozilla.com:444/a",
      "https://evil.test/a",
    ])
      assert.equal(validPushEndpoint(value), false);
  });
  it("reports Web Push unavailable until both VAPID and authenticated storage encryption are configured", () => {
    const vapid = webPush.generateVAPIDKeys();
    const config = new ConfigService({
      INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: "mailto:admin@example.test",
    });
    const ready = new WebPushService(
      {} as PrismaService,
      {} as IntegrationOwnerService,
      new IntegrationSecretsService(config),
      config,
    );
    assert.equal(ready.available(), true);
    const missing = new WebPushService(
      {} as PrismaService,
      {} as IntegrationOwnerService,
      new IntegrationSecretsService(new ConfigService()),
      new ConfigService(),
    );
    assert.equal(missing.available(), false);
  });
});
