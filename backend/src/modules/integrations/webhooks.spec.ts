import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { IntegrationSecretsService } from "./integration-secrets.service";
import {
  WebhookTransportService,
  publicWebhookIPv4,
} from "./webhook-transport.service";
import { WebhooksService, webhookSignature } from "./webhooks.service";
import { IntegrationOwnerService } from "./integration-owner.service";

const config = () =>
  new ConfigService({
    INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    WEBHOOK_ALLOWED_HOSTS: "hooks.example.test",
  });

describe("Outgoing webhook boundary", () => {
  it("encrypts signing secrets with authenticated randomized encryption and rejects tampering", () => {
    const secrets = new IntegrationSecretsService(config());
    const first = secrets.encrypt("my-signing-secret");
    assert.notEqual(first, secrets.encrypt("my-signing-secret"));
    assert.equal(secrets.decrypt(first), "my-signing-secret");
    const changed = Buffer.from(first, "base64");
    changed[20] ^= 1;
    assert.throws(() => secrets.decrypt(changed.toString("base64")));
    assert.equal(
      new IntegrationSecretsService(new ConfigService()).available(),
      false,
    );
  });
  it("only accepts explicit HTTPS hosts and refuses credentials, IP literals, redirects and alternate ports", () => {
    const transport = new WebhookTransportService(config());
    assert.equal(
      transport.validate("https://hooks.example.test/sales").pathname,
      "/sales",
    );
    for (const value of [
      "http://hooks.example.test/a",
      "https://hooks.example.test.evil.test/a",
      "https://hooks.example.test@evil.test/a",
      "https://127.0.0.1/a",
      "https://hooks.example.test:8443/a",
      "https://hooks.example.test/a#fragment",
    ])
      assert.throws(() => transport.validate(value));
    for (const value of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.1.1",
      "100.64.0.1",
      "::1",
      "224.0.0.1",
    ])
      assert.equal(publicWebhookIPv4(value), false);
    assert.equal(publicWebhookIPv4("8.8.8.8"), true);
  });
  it("binds HMAC signatures to the timestamp and exact serialized bytes", () => {
    const signed = webhookSignature("secret", "123", '{"a":1}');
    assert.match(signed, /^v1=[0-9a-f]{64}$/);
    assert.notEqual(signed, webhookSignature("secret", "124", '{"a":1}'));
    assert.notEqual(signed, webhookSignature("secret", "123", '{ "a": 1 }'));
  });
  for (const [status, delivered] of [
    [200, true],
    [302, false],
    [500, false],
  ] as const) {
    it(`records HTTP ${status} as ${delivered ? "delivered" : "a durable retry"} using a stable delivery ID`, async () => {
      const secrets = new IntegrationSecretsService(config());
      const updates: Array<{
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }> = [];
      const payload = {
        id: "event-a",
        type: "sale.created",
        data: { totalAmount: "1.23" },
      };
      const row = {
        id: "delivery-a",
        endpointId: "endpoint-a",
        eventId: "event-a",
        payload,
        attempts: 0,
        endpoint: {
          companyId: "company-a",
          isActive: true,
          url: "https://hooks.example.test/sales",
          encryptedSecret: secrets.encrypt("secret"),
          company: { status: "ACTIVE" },
          membership: {
            isActive: true,
            role: "COMPANY_ADMIN",
            user: { isActive: true },
          },
        },
      };
      const prisma = {
        webhookDelivery: {
          findMany: async () => [row],
          updateMany: async (args: (typeof updates)[number]) => {
            updates.push(args);
            return { count: 1 };
          },
        },
      };
      const transport = {
        send: async (
          _url: string,
          body: string,
          headers: Record<string, string>,
        ) => {
          assert.equal(headers["X-Ventas-Delivery"], row.id);
          assert.equal(
            headers["X-Ventas-Signature"],
            webhookSignature("secret", headers["X-Ventas-Timestamp"], body),
          );
          assert.deepEqual(JSON.parse(body), payload);
          return status;
        },
      };
      const plans = {
        getCapabilities: async () => ({}),
        hasFeature: () => true,
      };
      const service = new WebhooksService(
        prisma as unknown as PrismaService,
        {} as IntegrationOwnerService,
        secrets,
        transport as WebhookTransportService,
        plans as unknown as PlanCapabilitiesService,
      );
      await service.process();
      assert.equal(updates.length, 2);
      assert.equal(updates[1].where.leaseToken, updates[0].data.leaseToken);
      assert.equal(updates[1].data.statusCode, status);
      assert.equal(updates[1].data.deliveredAt instanceof Date, delivered);
      if (!delivered) assert.ok(updates[1].data.availableAt instanceof Date);
    });
  }
  it("does not deliver work claimed by another worker", async () => {
    let sends = 0;
    const prisma = {
      webhookDelivery: {
        findMany: async () => [{ id: "delivery", attempts: 0 }],
        updateMany: async () => ({ count: 0 }),
      },
    };
    const service = new WebhooksService(
      prisma as unknown as PrismaService,
      {} as IntegrationOwnerService,
      {} as IntegrationSecretsService,
      {
        send: async () => {
          sends++;
          return 200;
        },
      } as unknown as WebhookTransportService,
      {} as PlanCapabilitiesService,
    );
    await service.process();
    assert.equal(sends, 0);
  });
});
