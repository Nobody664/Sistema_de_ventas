import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { STORE_ACCESS_KEY } from "@/common/decorators/store-access.decorator";
import { StoreCryptoService } from "./store-crypto.service";
import { StoreStrategy } from "./store.strategy";

const config = new ConfigService({
  JWT_ACCESS_SECRET: "staff-access-secret-long",
  JWT_REFRESH_SECRET: "refresh-secret-long",
});

test("la firma comercial no puede validar con la clave laboral y los datos privados se cifran", async () => {
  const crypto = new StoreCryptoService(config);
  const jwt = new JwtService();
  const token = jwt.sign(
    { sub: "client" },
    { secret: crypto.signingKey(), audience: "store" },
  );
  assert.throws(() =>
    jwt.verify(token, { secret: config.getOrThrow("JWT_ACCESS_SECRET") }),
  );
  assert.throws(() =>
    jwt.verify(token, { secret: crypto.signingKey(), audience: "staff" }),
  );
  assert.equal(
    jwt.verify(token, { secret: crypto.signingKey(), audience: "store" }).sub,
    "client",
  );
  const encrypted = crypto.encrypt("token privado y DNI");
  assert.equal(encrypted.includes("DNI"), false);
  assert.equal(crypto.decrypt(encrypted), "token privado y DNI");
  assert.throws(() => crypto.decrypt(encrypted.slice(0, -8)));
});

test("el guard global deriva solo las rutas comerciales marcadas a su estrategia", async () => {
  const handler = () => undefined;
  Reflect.defineMetadata(STORE_ACCESS_KEY, true, handler);
  const context = {
    getHandler: () => handler,
    getClass: () => class Controller {},
  } as ExecutionContext;
  let invoked = 0;
  const guard = new JwtAuthGuard(new Reflector(), {
    canActivate: () => {
      invoked++;
      return true;
    },
  } as never);
  assert.equal(await guard.canActivate(context), true);
  assert.equal(invoked, 1);
  assert.throws(() => new JwtAuthGuard(new Reflector()).canActivate(context));
});

test("la estrategia no confía en roles enviados y rechaza otra tienda, usuario revocado y cuenta suspendida", async () => {
  const session = {
    id: "s",
    authVersion: 1,
    account: {
      id: "a",
      companyId: "c",
      customerId: "buyer",
      userId: "u",
      status: "ACTIVE",
      user: { isActive: true, authVersion: 1 },
      customer: { deletedAt: null },
      company: { slug: "tienda-a" },
    },
  };
  const strategy = new StoreStrategy(
    { storeSession: { findFirst: async () => session } } as never,
    new StoreCryptoService(config),
  );
  const payload = {
    sid: "s",
    sub: "u",
    accountId: "a",
    companyId: "c",
    authVersion: 1,
    roles: ["SUPER_ADMIN"],
  };
  const actor = await strategy.validate(
    { params: { slug: "tienda-a" } } as never,
    payload,
  );
  assert.deepEqual(actor.roles, ["USUARIO_CLIENTE_FINAL"]);
  await assert.rejects(
    strategy.validate({ params: { slug: "tienda-b" } } as never, payload),
  );
  await assert.rejects(
    strategy.validate({ params: {} } as never, { ...payload, authVersion: 0 }),
  );
  session.account.status = "SUSPENDED";
  await assert.rejects(strategy.validate({ params: {} } as never, payload));
});
