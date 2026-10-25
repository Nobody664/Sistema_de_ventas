import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { HttpStatus, ForbiddenException, HttpException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function makeContext() {
  const response = {
    statusCode: 0,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const request = { method: "POST", url: "/test", originalUrl: "/test" };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
  return { response, context };
}

describe("AllExceptionsFilter", () => {
  it("preserva solo metadatos públicos tipados sin filtrar el objeto interno", () => {
    const { response, context } = makeContext();
    new AllExceptionsFilter().catch(
      new ForbiddenException({
        message: "Límite alcanzado",
        error: "LIMIT_EXCEEDED",
        limit: 10,
        current: 10,
        used: 10,
        remaining: 0,
        resource: "products",
        currentPlan: "FREE",
        requiredPlan: "PRO",
        planName: "Gratis",
        modules: ["products"],
        features: ["sales.discounts"],
        period: "2026-10",
        upgradeUrl: "/subscription",
        passwordHash: "secret",
        cause: { token: "secret" },
        stack: "secret",
        data: { user: "secret" },
      }),
      context,
    );
    assert.equal(response.body.limit, 10);
    assert.equal(response.body.remaining, 0);
    assert.deepEqual(response.body.modules, ["products"]);
    assert.equal(response.body.upgradeUrl, "/subscription");
    for (const field of ["passwordHash", "cause", "stack", "data"])
      assert.equal(response.body[field], undefined);
  });
  it("omite metadatos mal formados, URLs externas y detalles de respuestas 5xx", () => {
    const { response, context } = makeContext();
    const filter = new AllExceptionsFilter();
    filter.catch(
      new ForbiddenException({
        message: "No disponible",
        limit: "10",
        used: NaN,
        remaining: -1,
        modules: [{ secret: true }],
        features: ["a".repeat(129)],
        upgradeUrl: "https://example.invalid",
        period: "2026-99",
      }),
      context,
    );
    for (const field of [
      "limit",
      "used",
      "remaining",
      "modules",
      "features",
      "upgradeUrl",
      "period",
    ])
      assert.equal(response.body[field], undefined);
    filter.catch(
      new HttpException(
        { message: "Fallo", limit: 100, currentPlan: "PRIVATE" },
        503,
      ),
      context,
    );
    assert.equal(response.body.limit, undefined);
    assert.equal(response.body.currentPlan, undefined);
  });
  it("mapea Prisma P2002 a 409 y expone el campo duplicado en el mensaje", () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.10.0",
      meta: { target: ["idempotencyKey"] },
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.code, "P2002");
    assert.match(response.body.message, /idempotencyKey/);
  });

  it("mapea P2002 a 409 con mensaje generico cuando no hay target", () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.10.0",
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.CONFLICT);
    assert.equal(response.body.message, "Ya existe un registro con esos datos");
  });

  it("mapea Prisma P2025 a 404", () => {
    const filter = new AllExceptionsFilter();
    const { response, context } = makeContext();
    const err = new PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "7.10.0",
    });

    filter.catch(err, context);

    assert.equal(response.statusCode, HttpStatus.NOT_FOUND);
    assert.equal(response.body.message, "Recurso no encontrado");
  });
});
