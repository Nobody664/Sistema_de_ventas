import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Logger } from "@nestjs/common";
import { StoreAdminTelemetryMiddleware } from "./store-admin-telemetry.middleware";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";

test("la telemetría observa un 403 sin registrar consultas ni credenciales", (t) => {
  const events: string[] = [];
  t.mock.method(Logger.prototype, "log", (message: string) => {
    events.push(message);
  });
  const response = Object.assign(new EventEmitter(), {
    statusCode: 403,
    writableFinished: true,
  });
  let next = false;
  new StoreAdminTelemetryMiddleware({ get: () => "true" } as never).use(
    {
      method: "GET",
      route: { path: "/store-admin/orders/:id" },
      originalUrl: "/store-admin/orders?q=secret@example.test",
      headers: { authorization: "Bearer private" },
      user: { companyId: "company-a" },
    } as never,
    response as never,
    () => {
      next = true;
    },
  );
  response.emit("finish");
  response.emit("close");
  assert.equal(next, true);
  assert.equal(events.length, 1);
  const data = JSON.parse(events[0]);
  assert.equal(data.status, 403);
  assert.equal(data.route, "/store-admin/orders/:id");
  assert.equal(events[0].includes("secret@example.test"), false);
  assert.equal(events[0].includes("Bearer"), false);
  assert.equal(typeof data.durationMs, "number");
});

test("los errores administrativos no escriben valores privados ni stacks en logs", (t) => {
  const messages: unknown[] = [];
  t.mock.method(Logger.prototype, "error", (...args: unknown[]) => {
    messages.push(args);
  });
  const response = { status: () => response, json: () => response };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        originalUrl: "/api/store-admin/orders?q=secret@example.test",
        url: "/store-admin/orders?q=secret@example.test",
        route: { path: "/api/store-admin/orders" },
      }),
      getResponse: () => response,
    }),
  };
  new AllExceptionsFilter().catch(
    new Error("secret@example.test private note"),
    host as never,
  );
  assert.equal(JSON.stringify(messages).includes("secret@example.test"), false);
  assert.equal(JSON.stringify(messages).includes("private note"), false);
  assert.equal(
    JSON.stringify(messages).includes("/api/store-admin/orders"),
    true,
  );
});
