import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";
import { StoreAuthService } from "./store-auth.service";
import { StoreCartService } from "./store-cart.service";
import { StoreController } from "./store.controller";
import { StoreMethodsService } from "./store-methods.service";
import { StoreService } from "./store.service";
import type { StoreActor } from "./store.strategy";

test("HTTP comercial rechaza sobreasignación y formatos maliciosos antes de tocar servicios; el catálogo conserva filtros parametrizados", async () => {
  const actor: StoreActor = {
    sub: "buyer",
    accountId: "account-a",
    companyId: "company-a",
    customerId: "customer-a",
    sid: "session-a",
    roles: ["USUARIO_CLIENTE_FINAL"],
  };
  let writes = 0;
  let searchWhere: unknown;
  let registration: unknown;
  const prisma = {
    company: {
      findUnique: async () => ({
        id: actor.companyId,
        slug: "negocio-demo",
        status: "ACTIVE",
        currency: "PEN",
        storefront: { enabled: true },
      }),
    },
    product: {
      findMany: async (input: { where: unknown }) => {
        searchWhere = input.where;
        return [];
      },
      count: async () => 0,
    },
  };
  const store = new StoreService(
    prisma as never,
    { getCapabilities: async () => ({}), hasModule: () => true } as never,
    { available: async () => new Map() } as never,
  );
  const module = await Test.createTestingModule({
    controllers: [StoreController],
    providers: [
      { provide: StoreService, useValue: store },
      { provide: PrismaService, useValue: prisma },
      {
        provide: StoreAuthService,
        useValue: {
          register: async (_slug: string, input: unknown) => {
            writes++;
            registration = input;
            return { message: "Cuenta creada" };
          },
          profile: async () => {
            writes++;
            return {};
          },
          address: async () => {
            writes++;
            return {};
          },
        },
      },
      {
        provide: StoreCartService,
        useValue: {
          change: async () => {
            writes++;
            return {};
          },
          quote: async () => {
            writes++;
            return {};
          },
        },
      },
      { provide: StoreMethodsService, useValue: {} },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: StoreActor }).user = actor;
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  try {
    await app.listen(0, "127.0.0.1");
    const base = `${await app.getUrl()}/store/negocio-demo`;
    const send = (path: string, body: unknown, method = "POST") =>
      fetch(`${base}/${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const profile = {
      firstName: "Ana",
      lastName: "O'Connor",
      documentValue: "00123456",
      phone: "999111222",
    };
    for (const [path, body, method] of [
      ["me", { ...profile, companyId: "company-b" }, "PATCH"],
      ["me", { ...profile, firstName: "<script>alert(1)</script>" }, "PATCH"],
      ["me", { ...profile, phone: "-------" }, "PATCH"],
      [
        "me/addresses",
        {
          label: "Casa",
          recipient: "Ana",
          phone: "999111222",
          street: "Calle segura 123",
          district: "150101 OR 1=1",
          isDefault: true,
        },
        "POST",
      ],
      [
        "cart/items",
        { version: 1, productId: "p", quantity: 1, unitPrice: 0 },
        "POST",
      ],
      ["cart/items", { version: 1, productId: "p", quantity: true }, "POST"],
      ["cart/items", { version: 1, productId: "p", quantity: "" }, "POST"],
      ["cart/items", { version: 1, productId: "p", quantity: 0.0001 }, "POST"],
      [
        "checkout/quote",
        {
          cartVersion: 1,
          paymentMethodId: "pay",
          shippingMethodId: "pickup",
          accountId: "foreign",
        },
        "POST",
      ],
      [
        "checkout/quote",
        {
          cartVersion: 1,
          paymentMethodId: "' OR 1=1",
          shippingMethodId: "pickup",
        },
        "POST",
      ],
    ] as const) {
      const response = await send(path, body, method);
      assert.equal(response.status, 400, path);
      const result = await response.text();
      assert.ok(!result.includes("passwordHash"));
      assert.ok(!result.includes("stack"));
    }
    assert.equal(writes, 0);
    const valid = await send("auth/register", {
      firstName: "  María  ",
      lastName: "O'Connor",
      email: " PERSONA@EXAMPLE.COM ",
      password: " Clave con espacios ",
      acceptTerms: true,
    });
    assert.equal(valid.status, 201);
    assert.equal(valid.headers.get("cache-control"), "private, no-store");
    await valid.arrayBuffer();
    assert.deepEqual(JSON.parse(JSON.stringify(registration)), {
      firstName: "María",
      lastName: "O'Connor",
      email: "persona@example.com",
      password: " Clave con espacios ",
      acceptTerms: true,
    });
    const attack = "' OR 1=1; --";
    const catalog = await fetch(
      `${base}/catalog?search=${encodeURIComponent(attack)}`,
    );
    assert.equal(catalog.status, 200);
    await catalog.arrayBuffer();
    assert.deepEqual(searchWhere, {
      companyId: "company-a",
      storeVisible: true,
      isActive: true,
      deletedAt: null,
      name: { contains: attack, mode: "insensitive" },
    });
    for (const query of [
      "categoryId=foo%27%20OR%201%3D1",
      "limit=999999",
      "search%5Bcontains%5D=x",
    ]) {
      const response = await fetch(`${base}/catalog?${query}`);
      assert.equal(response.status, 400);
      await response.arrayBuffer();
    }
    const invalidId = await fetch(
      `${base}/catalog/${encodeURIComponent("' OR 1=1")}`,
    );
    assert.equal(invalidId.status, 400);
    await invalidId.arrayBuffer();
  } finally {
    await app.close();
  }
});
