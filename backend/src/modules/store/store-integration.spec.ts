import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import {
  Controller,
  Get,
  ValidationPipe,
  INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { PrismaService } from "@/database/prisma/prisma.service";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { AuditCommonModule } from "@/common/services/audit.module";
import { JwtStrategy } from "@/modules/auth/jwt.strategy";
import { EmailService } from "@/modules/email/email.service";
import { PlanCapabilitiesModule } from "@/modules/plan-capabilities/plan-capabilities.module";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { StoreModule } from "./store.module";
import { StoreCryptoService } from "./store-crypto.service";
import { StoreOrdersService } from "./store-orders.service";

@Controller("internal")
class InternalController {
  @Get() get() {
    return { private: true };
  }
}

test(
  "portal completo con Prisma, HTTP, todas las migraciones y PostgreSQL embebido: identidad, compra, cobro, retorno y webhooks",
  { timeout: 180000 },
  async (t) => {
    const db = new PGlite();
    const socket = new PGLiteSocketServer({
      db,
      port: 0,
      host: "127.0.0.1",
      maxConnections: 8,
    });
    const config = {
      JWT_ACCESS_SECRET: "staff-access-integration-secret",
      JWT_REFRESH_SECRET: "staff-refresh-integration-secret",
      FRONTEND_URL: "http://localhost:3000",
      SMTP_ENABLED: false,
    };
    let prisma: PrismaClient | undefined;
    let app: INestApplication | undefined;
    try {
      for (const entry of readdirSync(resolve("prisma/migrations"), {
        withFileTypes: true,
      })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name)))
        await db.exec(
          readFileSync(
            resolve("prisma/migrations", entry.name, "migration.sql"),
            "utf8",
          ),
        );
      await socket.start();
      prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres`,
          ssl: false,
          max: 4,
        }),
      });
      await prisma.$connect();
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => config],
          }),
          AuditCommonModule,
          PlanCapabilitiesModule,
          StoreModule,
        ],
        controllers: [InternalController],
        providers: [
          JwtStrategy,
          { provide: APP_GUARD, useClass: JwtAuthGuard },
          { provide: APP_GUARD, useClass: RolesGuard },
        ],
      })
        .overrideProvider(PrismaService)
        .useValue(prisma)
        .overrideProvider(PlanCapabilitiesService)
        .useValue({
          getCapabilities: async () => ({ modules: ["storefront"] }),
          hasModule: (cap: { modules: string[] }, name: string) =>
            cap.modules.includes(name),
        })
        .overrideProvider(EmailService)
        .useValue({ sendEmailDirect: async () => undefined })
        .compile();
      app = module.createNestApplication();
      const cookieParser = (await import("cookie-parser")).default;
      app.use(cookieParser());
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const request = async (
        path: string,
        method = "GET",
        body?: unknown,
        cookie?: string,
        headers?: Record<string, string>,
      ) => {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
            ...headers,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = (await response.json()) as Record<string, unknown>;
        return {
          status: response.status,
          value,
          cookie: response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; "),
        };
      };
      const company = await prisma.company.create({
        data: {
          name: "Tienda A",
          slug: "tienda-a",
          status: "ACTIVE",
          storefront: {
            create: {
              enabled: true,
              checkoutEnabled: true,
              taxRate: 18,
              pricesIncludeTax: true,
            },
          },
        },
      });
      await prisma.company.create({
        data: {
          name: "Tienda B",
          slug: "tienda-b",
          status: "ACTIVE",
          storefront: { create: { enabled: true } },
        },
      });
      const admin = await prisma.user.create({
        data: {
          email: "admin@example.test",
          fullName: "Admin",
          passwordHash: "unused",
          memberships: {
            create: { companyId: company.id, role: "COMPANY_ADMIN" },
          },
        },
      });
      await prisma.refreshToken.create({
        data: {
          userId: admin.id,
          companyId: company.id,
          familyId: "staff",
          tokenHash: "staff-token",
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const token = new JwtService().sign(
        { sub: admin.id, sid: "staff", companyId: company.id, authVersion: 0 },
        { secret: config.JWT_ACCESS_SECRET, expiresIn: "1h" },
      );
      const staff = `access_token=${token}`;
      assert.equal(
        (await request("/platform/email", "GET", undefined, staff)).status,
        403,
      );
      const platformUser = await prisma.user.create({
        data: {
          email: "platform@example.test",
          fullName: "Platform",
          passwordHash: "unused",
          globalRole: "SUPER_ADMIN",
        },
      });
      await prisma.refreshToken.create({
        data: {
          userId: platformUser.id,
          familyId: "platform-email",
          tokenHash: "platform-email-token",
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const platformToken = new JwtService().sign(
        {
          sub: platformUser.id,
          sid: "platform-email",
          companyId: null,
          authVersion: 0,
        },
        { secret: config.JWT_ACCESS_SECRET, expiresIn: "1h" },
      );
      const platformCookie = `access_token=${platformToken}`;
      const diagnostic = await request(
        "/platform/email",
        "GET",
        undefined,
        platformCookie,
      );
      assert.equal(diagnostic.status, 200);
      assert.equal(diagnostic.value.enabled, false);
      assert.equal(
        (
          await request(
            "/platform/email/test",
            "POST",
            { to: "not-an-email" },
            platformCookie,
          )
        ).status,
        400,
      );
      assert.equal(
        (await request("/internal", "GET", undefined, staff)).status,
        200,
      );
      const registration = await request(
        "/store/tienda-a/auth/register",
        "POST",
        {
          email: "buyer@example.test",
          password: "Buyer-Password-123",
          firstName: "Ana",
          lastName: "Pérez",
          acceptTerms: true,
        },
      );
      assert.equal(registration.status, 201);
      assert.equal(await prisma.membership.count(), 1);
      const crypto = module.get(StoreCryptoService);
      let client = (
        await request("/store/tienda-a/auth/login", "POST", {
          email: "buyer@example.test",
          password: "Buyer-Password-123",
        })
      ).cookie;
      assert.ok(client.includes("store_access_token"));
      assert.equal(
        (await request("/platform/email", "GET", undefined, client)).status,
        401,
      );
      assert.equal(
        (await request("/internal", "GET", undefined, client)).status,
        401,
      );
      assert.equal(
        (await request("/store-admin/settings", "GET", undefined, client))
          .status,
        401,
      );
      assert.equal(
        (await request("/store/tienda-b/me", "GET", undefined, client)).status,
        401,
      );
      assert.equal(
        (await request("/store/tienda-a/me", "GET", undefined, staff)).status,
        401,
      );
      const refresh = await request(
        "/store/tienda-a/auth/refresh",
        "POST",
        {},
        client,
      );
      assert.equal(refresh.status, 201);
      const replay = await request(
        "/store/tienda-a/auth/refresh",
        "POST",
        {},
        client,
      );
      assert.equal(replay.status, 401);
      assert.equal(
        (await request("/store/tienda-a/me", "GET", undefined, refresh.cookie))
          .status,
        401,
      );
      client = (
        await request("/store/tienda-a/auth/login", "POST", {
          email: "buyer@example.test",
          password: "Buyer-Password-123",
        })
      ).cookie;
      assert.equal(
        (
          await request(
            "/store/tienda-a/me",
            "PATCH",
            {
              firstName: "Ana",
              lastName: "Pérez",
              documentValue: "00123456",
              phone: "+51999111222",
            },
            client,
          )
        ).status,
        200,
      );
      const product = await prisma.product.create({
        data: {
          companyId: company.id,
          name: "Café",
          storeVisible: true,
          stockQuantity: 5,
          salePrice: "11.80",
          costPrice: 2,
        },
      });
      const catalog = await request(
        "/store/tienda-a/catalog",
        "GET",
        undefined,
        client,
      );
      assert.equal(catalog.status, 200);
      assert.equal(JSON.stringify(catalog.value).includes("costPrice"), false);
      assert.equal(
        JSON.stringify(catalog.value).includes("stockQuantity"),
        false,
      );
      const literalSearch = await request(
        `/store/tienda-a/catalog?search=${encodeURIComponent("' OR 1=1; --")}`,
        "GET",
        undefined,
        client,
      );
      assert.equal(literalSearch.status, 200);
      assert.equal(literalSearch.value.total, 0);
      const address = await request(
        "/store/tienda-a/me/addresses",
        "POST",
        {
          label: "Casa",
          recipient: "Ana O'Connor",
          street: "Av. Los Álamos 123",
          district: "150101",
          phone: "999111222",
          isDefault: true,
        },
        client,
      );
      assert.equal(address.status, 201);
      assert.deepEqual(Object.keys(address.value.addresses[0]).sort(), [
        "district",
        "id",
        "isDefault",
        "label",
        "phone",
        "recipient",
        "reference",
        "street",
      ]);
      assert.equal(
        JSON.stringify(address.value).includes("passwordHash"),
        false,
      );
      const payment = await prisma.storePaymentMethod.create({
        data: {
          companyId: company.id,
          code: "YAPE",
          label: "Yape",
          instructions: "Paga al negocio",
        },
      });
      const shipping = await prisma.storeShippingMethod.create({
        data: {
          companyId: company.id,
          kind: "PICKUP",
          label: "Retiro",
          fee: 0,
          pickupAddress: "Av. Principal 123",
        },
      });
      const methods = await request(
        "/store/tienda-a/methods",
        "GET",
        undefined,
        client,
      );
      assert.equal(methods.status, 200);
      assert.equal(
        methods.value.shipping[0].pickupAddress,
        "Av. Principal 123",
      );
      assert.equal(JSON.stringify(methods.value).includes("companyId"), false);
      const makeOrder = async (methodId = payment.id) => {
        const cart = await request(
          "/store/tienda-a/cart",
          "GET",
          undefined,
          client,
        );
        assert.equal(
          (
            await request(
              "/store/tienda-a/cart/items",
              "POST",
              {
                version: cart.value.version,
                productId: product.id,
                quantity: 2,
                unitPrice: 0,
              },
              client,
            )
          ).status,
          400,
        );
        const changed = await request(
          "/store/tienda-a/cart/items",
          "POST",
          { version: cart.value.version, productId: product.id, quantity: 2 },
          client,
        );
        assert.equal(changed.status, 201);
        const quote = await request(
          "/store/tienda-a/checkout/quote",
          "POST",
          {
            cartVersion: changed.value.version,
            paymentMethodId: methodId,
            shippingMethodId: shipping.id,
          },
          client,
        );
        assert.equal(quote.status, 201, JSON.stringify(quote.value));
        const body = {
          quoteId: quote.value.id,
          idempotencyKey: crypto.signingKey().slice(0, 16) + String(Date.now()),
        };
        const result = await request(
          "/store/tienda-a/orders",
          "POST",
          body,
          client,
        );
        assert.equal(result.status, 201, JSON.stringify(result.value));
        const duplicate = await request(
          "/store/tienda-a/orders",
          "POST",
          body,
          client,
        );
        assert.equal(duplicate.value.id, result.value.id);
        return result.value;
      };
      let order = await makeOrder();
      assert.equal(order.totalAmount, "23.6");
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).reservedQuantity.toNumber(),
        2,
      );
      await assert.rejects(
        prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: { decrement: 4 } },
        }),
      );
      const image = `data:image/png;base64,${(
        await sharp({
          create: { width: 2, height: 2, channels: 3, background: "white" },
        })
          .png()
          .toBuffer()
      ).toString("base64")}`;
      const proof = await request(
        `/store/tienda-a/orders/${order.id}/payment-proofs`,
        "POST",
        { image },
        client,
      );
      assert.equal(proof.status, 201);
      assert.equal(proof.value.paymentStatus, "UNDER_REVIEW");
      assert.equal(await prisma.sale.count(), 0);
      order = proof.value;
      const approve = await request(
        `/store-admin/orders/${order.id}`,
        "PATCH",
        {
          action: "APPROVE_PAYMENT",
          version: order.version,
          reference: "YAPE-REAL-001",
        },
        staff,
      );
      assert.equal(approve.status, 200, JSON.stringify(approve.value));
      order = approve.value;
      assert.equal(order.paymentStatus, "PAID");
      assert.equal(await prisma.sale.count(), 1);
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).stockQuantity.toNumber(),
        3,
      );
      const again = await request(
        `/store-admin/orders/${order.id}`,
        "PATCH",
        {
          action: "APPROVE_PAYMENT",
          version: order.version,
          reference: "YAPE-REAL-001",
        },
        staff,
      );
      assert.equal(again.status, 200);
      assert.equal(await prisma.sale.count(), 1);
      for (const action of ["PREPARE", "READY", "DELIVER"]) {
        const result = await request(
          `/store-admin/orders/${order.id}`,
          "PATCH",
          { action, version: order.version },
          staff,
        );
        assert.equal(result.status, 200, JSON.stringify(result.value));
        order = result.value;
      }
      assert.equal(order.status, "COMPLETED");
      const refunded = await request(
        `/store-admin/orders/${order.id}/refund`,
        "POST",
        { reference: "DEVOLUCION-REAL-001" },
        staff,
      );
      assert.equal(refunded.status, 201);
      assert.equal(refunded.value.paymentStatus, "REFUNDED");
      const restocked = await request(
        `/store-admin/orders/${order.id}`,
        "PATCH",
        { action: "RESTOCK", version: refunded.value.version },
        staff,
      );
      assert.equal(restocked.status, 200, JSON.stringify(restocked.value));
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).stockQuantity.toNumber(),
        5,
      );
      assert.equal(
        (
          await request(
            `/store-admin/orders/${order.id}`,
            "PATCH",
            { action: "RESTOCK", version: restocked.value.version },
            staff,
          )
        ).status,
        400,
      );

      const provider = new Map<string, Record<string, unknown>>();
      const originalFetch = globalThis.fetch;
      t.mock.method(
        globalThis,
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
          if (!String(url).startsWith("https://api.mercadopago.com"))
            return originalFetch(url, init);
          if (String(url).endsWith("/users/me"))
            return Response.json({ id: 777 });
          if (String(url).endsWith("/checkout/preferences"))
            return Response.json({
              id: "pref",
              init_point:
                "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref",
              sandbox_init_point:
                "https://sandbox.mercadopago.com.pe/checkout/v1/redirect?pref_id=pref",
            });
          const id = String(url).split("/").pop()!;
          return Response.json(provider.get(id) ?? {});
        },
      );
      assert.equal(
        (
          await request(
            "/store-admin/integration",
            "POST",
            {
              accessToken: "merchant-token-private",
              webhookSecret: "merchant-webhook-secret",
              liveMode: false,
              enabled: true,
            },
            staff,
          )
        ).status,
        201,
      );
      const gateway = await prisma.storePaymentMethod.create({
        data: {
          companyId: company.id,
          code: "MERCADOPAGO",
          label: "Mercado Pago",
          instructions: "Checkout",
        },
      });
      const online = await makeOrder(gateway.id);
      assert.equal(
        (
          await request(
            `/store/tienda-a/orders/${online.id}/payments`,
            "POST",
            {},
            client,
          )
        ).status,
        201,
      );
      const attempt = await prisma.storePaymentAttempt.findUniqueOrThrow({
        where: { orderId: String(online.id) },
      });
      const integration =
        await prisma.storePaymentIntegration.findUniqueOrThrow({
          where: { companyId: company.id },
        });
      provider.set("111", {
        id: 111,
        status: "approved",
        collector_id: 777,
        live_mode: false,
        currency_id: "PEN",
        transaction_amount: 23.6,
        external_reference: attempt.id,
      });
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = "request-1";
      const signature = createHmac("sha256", "merchant-webhook-secret")
        .update(`id:111;request-id:${requestId};ts:${ts};`)
        .digest("hex");
      const hook = `/store-payments/webhooks/${integration.publicId}?data.id=111`;
      assert.equal(
        (await request(hook, "POST", { status: "approved" }, undefined)).status,
        401,
      );
      const headers = {
        "x-signature": `ts=${ts},v1=${signature}`,
        "x-request-id": requestId,
      };
      assert.equal(
        (await request(hook, "POST", {}, undefined, headers)).status,
        201,
      );
      assert.equal(
        (await request(hook, "POST", {}, undefined, headers)).status,
        201,
      );
      assert.equal(await prisma.sale.count(), 2);
      assert.equal(
        (
          await prisma.storeOrder.findUniqueOrThrow({
            where: { id: String(online.id) },
          })
        ).paymentStatus,
        "PAID",
      );
      const late = await makeOrder(gateway.id);
      assert.equal(
        (
          await request(
            `/store/tienda-a/orders/${late.id}/payments`,
            "POST",
            {},
            client,
          )
        ).status,
        201,
      );
      const lateAttempt = await prisma.storePaymentAttempt.findUniqueOrThrow({
        where: { orderId: String(late.id) },
      });
      await prisma.storeOrder.update({
        where: { id: String(late.id) },
        data: { expiresAt: new Date(0) },
      });
      await module.get(StoreOrdersService).expire();
      assert.equal(
        (
          await prisma.storeOrder.findUniqueOrThrow({
            where: { id: String(late.id) },
          })
        ).status,
        "EXPIRED",
      );
      assert.equal(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
        ).reservedQuantity.toNumber(),
        0,
      );
      provider.set("112", {
        id: 112,
        status: "approved",
        collector_id: 777,
        live_mode: false,
        currency_id: "PEN",
        transaction_amount: 23.6,
        external_reference: lateAttempt.id,
      });
      const lateSignature = createHmac("sha256", "merchant-webhook-secret")
        .update(`id:112;request-id:${requestId};ts:${ts};`)
        .digest("hex");
      const lateHeaders = {
        "x-signature": `ts=${ts},v1=${lateSignature}`,
        "x-request-id": requestId,
      };
      const lateHook = `/store-payments/webhooks/${integration.publicId}?data.id=112`;
      assert.equal(
        (await request(lateHook, "POST", {}, undefined, lateHeaders)).status,
        201,
      );
      const review = await prisma.storeOrder.findUniqueOrThrow({
        where: { id: String(late.id) },
      });
      assert.equal(review.status, "REVIEW_REQUIRED");
      assert.equal(review.paymentStatus, "PAID");
      assert.equal(review.saleId, null);
      assert.equal(await prisma.sale.count(), 2);
      provider.set("112", {
        ...provider.get("112"),
        status: "refunded",
        transaction_amount_refunded: 23.6,
      });
      assert.equal(
        (await request(lateHook, "POST", {}, undefined, lateHeaders)).status,
        201,
      );
      assert.equal(
        (
          await prisma.storeOrder.findUniqueOrThrow({
            where: { id: String(late.id) },
          })
        ).paymentStatus,
        "REFUNDED",
      );
      const secondUser = await prisma.user.create({
        data: {
          email: "second@example.test",
          fullName: "Otro cliente",
          passwordHash: "unused",
        },
      });
      const secondCustomer = await prisma.customer.create({
        data: { companyId: company.id, firstName: "Otro", lastName: "Cliente" },
      });
      const secondAccount = await prisma.customerAccount.create({
        data: {
          companyId: company.id,
          userId: secondUser.id,
          customerId: secondCustomer.id,
          status: "ACTIVE",
          verifiedAt: new Date(),
        },
      });
      const secondSession = await prisma.storeSession.create({
        data: {
          companyId: company.id,
          accountId: secondAccount.id,
          authVersion: 0,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const secondToken = new JwtService().sign(
        {
          sub: secondUser.id,
          sid: secondSession.id,
          companyId: company.id,
          accountId: secondAccount.id,
          authVersion: 0,
        },
        { audience: "store", secret: crypto.signingKey(), expiresIn: "1h" },
      );
      assert.equal(
        (
          await request(
            `/store/tienda-a/orders/${online.id}`,
            "GET",
            undefined,
            `store_access_token=${secondToken}`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await request(
            `/store/tienda-a/orders/${online.id}/cancel`,
            "POST",
            {},
            `store_access_token=${secondToken}`,
          )
        ).status,
        404,
      );
      const privateResponse = await fetch(`${base}/store/tienda-a/me`, {
        headers: { Cookie: client },
      });
      assert.equal(
        privateResponse.headers.get("cache-control"),
        "private, no-store",
      );
      assert.ok((await prisma.storeNotification.count()) > 0);
      assert.ok((await prisma.storeMail.count()) > 0);
      assert.equal(
        (
          await request(
            "/store/tienda-a/orders/not-owned",
            "GET",
            undefined,
            client,
          )
        ).status,
        404,
      );
    } finally {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
      await socket.stop();
      await db.close();
    }
  },
);
