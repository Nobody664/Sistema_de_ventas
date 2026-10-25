import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { PlanUpgradeRequestsController } from "@/modules/subscriptions/plan-upgrade-requests.controller";
import { PlanUpgradeRequestsService } from "@/modules/subscriptions/plan-upgrade-requests.service";
import { PlatformUpgradeRequestsController } from "@/modules/platform/platform-upgrade-requests.controller";
import { PlatformAuditService } from "@/modules/platform/platform-audit.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Controller("public-error-contract")
class ErrorContractController {
  @Get()
  fail(): never {
    throw new ForbiddenException({
      error: "LIMIT_EXCEEDED",
      message: "Límite alcanzado",
      limit: 10,
      used: 10,
      remaining: 0,
      currentPlan: "FREE",
      modules: ["products"],
      upgradeUrl: "/subscription",
      passwordHash: "not-public",
    });
  }
}

type Template = {
  id: string;
  companyId: string | null;
  isGlobal: boolean;
  isDefault: boolean;
  isActive: boolean;
  content: string;
  name: string;
  taxPercentage?: number;
};
type Upgrade = {
  id: string;
  companyId: string;
  planId: string;
  amount: string;
  currency: string;
  status: string;
  billingCycle: string;
  provider: string;
  paymentDate?: Date;
};
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

describe("Final backend HTTP contracts", () => {
  let app: INestApplication;
  let url: string;
  let templates: Template[] = [];
  let upgrade: Upgrade | null = null;
  let failTemplate = false;
  let subscriptionCycle: string | undefined;
  let subscriptionEnd: Date | undefined;
  const plan = {
    id: "pro",
    code: "PRO",
    name: "Pro",
    priceMonthly: new Prisma.Decimal(10),
    priceYearly: new Prisma.Decimal(100),
    billingCycle: "MONTHLY",
    isActive: true,
  };
  const company = {
    id: "company-a",
    name: "Empresa",
    taxId: "20123456789",
    legalName: "Empresa SAC",
    address: "Avenida Principal 123",
    phone: "999999999",
    email: "owner@example.invalid",
    subscriptions: [
      { id: "sub", planId: "free", plan: { code: "FREE", name: "Gratis" } },
    ],
  };
  const matches = (row: Template, where: Record<string, unknown>): boolean => {
    for (const field of [
      "companyId",
      "isGlobal",
      "isDefault",
      "isActive",
    ] as const)
      if (where[field] !== undefined && row[field] !== where[field])
        return false;
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (
      where.id &&
      typeof where.id === "object" &&
      "not" in where.id &&
      row.id === where.id.not
    )
      return false;
    return (
      !Array.isArray(where.OR) ||
      where.OR.some((condition: Record<string, unknown>) =>
        matches(row, condition),
      )
    );
  };
  before(async () => {
    const prisma = {
      invoiceTemplate: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          templates.filter((row) => matches(row, where)),
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          templates
            .filter((row) => matches(row, where))
            .sort(
              (a, b) =>
                Number(b.isDefault) - Number(a.isDefault) ||
                Number(a.isGlobal) - Number(b.isGlobal),
            )[0] ?? null,
        updateMany: async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<Template>;
        }) => {
          const rows = templates.filter((row) => matches(row, where));
          for (const row of rows) Object.assign(row, data);
          return { count: rows.length };
        },
        create: async ({ data }: { data: Template }) => {
          assert.equal(typeof data.content, "string");
          if (failTemplate) throw new Error("template insert failed");
          const row = {
            ...data,
            id: `clx${String(templates.length + 1).padStart(22, "0")}`,
            isActive: true,
          };
          templates.push(row);
          return row;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Template>;
        }) => {
          if (failTemplate) throw new Error("template update failed");
          const row = templates.find((value) => value.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
      company: { findUnique: async () => company, update: async () => ({}) },
      plan: { findUnique: async () => plan },
      paymentSetting: {
        findFirst: async () => ({ provider: "YAPE", isEnabled: true }),
      },
      planUpgradeRequest: {
        create: async ({ data }: { data: Upgrade }) => {
          upgrade = { ...data, id: "clx12345678901234567890123" };
          return { ...upgrade, plan };
        },
        findFirst: async ({
          where,
        }: {
          where: { id?: string; companyId: string };
        }) =>
          where.id
            ? upgrade?.id === where.id && upgrade?.companyId === where.companyId
              ? { ...upgrade, company, plan }
              : null
            : null,
        findUnique: async ({ where }: { where: { id: string } }) =>
          upgrade?.id === where.id ? { ...upgrade, company, plan } : null,
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; status: string };
          data: Partial<Upgrade>;
        }) => {
          if (
            !upgrade ||
            upgrade.id !== where.id ||
            upgrade.status !== where.status
          )
            return { count: 0 };
          Object.assign(upgrade, data);
          return { count: 1 };
        },
      },
      subscription: {
        findUnique: async () => ({ id: "sub" }),
        update: async ({
          data,
        }: {
          data: { billingCycle: string; endDate: Date };
        }) => {
          subscriptionCycle = data.billingCycle;
          subscriptionEnd = data.endDate;
          return { id: "sub" };
        },
      },
      payment: { create: async () => ({}) },
      outboxEvent: { upsert: async () => ({}) },
      $transaction: async <T>(work: (tx: object) => Promise<T>) => {
        const beforeTemplates = templates.map((row) => ({ ...row }));
        try {
          return await work(prisma);
        } catch (error) {
          templates = beforeTemplates;
          throw error;
        }
      },
    };
    const authentication = {
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const role = request.headers["x-test-role"];
        if (!role) throw new UnauthorizedException();
        request.user = {
          sub: role === "SUPER_ADMIN" ? "platform" : "owner",
          email: "owner@example.invalid",
          roles: [role],
          companyId:
            request.headers["x-test-company"] ??
            (role === "SUPER_ADMIN" ? null : "company-a"),
          companyStatus: "ACTIVE",
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [
        InvoicesController,
        PlanUpgradeRequestsController,
        PlatformUpgradeRequestsController,
        ErrorContractController,
      ],
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: PlanUpgradeRequestsService,
          useValue: new PlanUpgradeRequestsService(
            prisma as unknown as PrismaService,
            {} as never,
            { notifySuperAdmins: async () => ({}) } as never,
            {} as never,
          ),
        },
        {
          provide: PlatformAuditService,
          useValue: { log: async () => undefined },
        },
        { provide: APP_GUARD, useValue: authentication },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authentication)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  after(async () => {
    await app?.close();
  });
  const request = (
    path: string,
    role = "SUPER_ADMIN",
    body?: unknown,
    method = "POST",
    companyId?: string,
  ) =>
    fetch(`${url}${path}`, {
      method,
      headers: {
        "x-test-role": role,
        "Content-Type": "application/json",
        ...(companyId ? { "x-test-company": companyId } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

  it("preserves the public error contract over HTTP without leaking unknown fields", async () => {
    const response = await request(
      "/public-error-contract",
      "COMPANY_ADMIN",
      undefined,
      "GET",
    );
    assert.equal(response.status, 403);
    const body = (await response.json()) as Record<string, unknown>;
    assert.equal(body.limit, 10);
    assert.equal(body.remaining, 0);
    assert.deepEqual(body.modules, ["products"]);
    assert.equal(body.passwordHash, undefined);
  });
  it("creates a global template without tenant context, persists its structured content and honors zero tax", async () => {
    const response = await request(
      "/invoices/templates/global",
      "SUPER_ADMIN",
      { name: "Primera", isDefault: true, taxPercentage: 0 },
    );
    assert.equal(response.status, 201);
    const body = (await response.json()) as Template;
    assert.equal(body.content, "STRUCTURED_V1");
    assert.equal(body.isDefault, true);
    assert.equal(body.companyId, null);
    assert.equal(body.taxPercentage, 0);
    assert.equal(
      (
        await request("/invoices/templates/global", "COMPANY_ADMIN", {
          name: "No autorizada",
        })
      ).status,
      403,
    );
  });
  it("changes defaults atomically within their own scope and hides tenant templates without context", async () => {
    const tenant = await request(
      "/invoices/templates",
      "SUPER_ADMIN",
      { name: "Empresa", isDefault: true },
      "POST",
      "company-a",
    );
    assert.equal(tenant.status, 201);
    const tenantTemplate = (await tenant.json()) as Template;
    const next = await request("/invoices/templates/global", "SUPER_ADMIN", {
      name: "Segunda",
      isDefault: true,
    });
    assert.equal(next.status, 201);
    assert.equal(
      templates.filter((row) => row.isGlobal && row.isDefault).length,
      1,
    );
    assert.equal(
      templates.find((row) => row.id === tenantTemplate.id)?.isDefault,
      true,
    );
    const first = templates.find((row) => row.name === "Primera")!;
    assert.equal(
      (
        await request(
          `/invoices/templates/${first.id}`,
          "SUPER_ADMIN",
          { isDefault: true },
          "PATCH",
        )
      ).status,
      200,
    );
    assert.equal(
      templates.filter((row) => row.isGlobal && row.isDefault).length,
      1,
    );
    assert.equal(
      (
        await request(
          `/invoices/templates/${tenantTemplate.id}`,
          "SUPER_ADMIN",
          undefined,
          "GET",
        )
      ).status,
      404,
    );
    const listed = await request(
      "/invoices/templates",
      "SUPER_ADMIN",
      undefined,
      "GET",
    );
    const rows = (await listed.json()) as Template[];
    assert.ok(rows.every((row) => row.isGlobal));
  });
  it("rolls back a default reset when the insert or update fails", async () => {
    const current = templates.find((row) => row.isGlobal && row.isDefault)!.id;
    failTemplate = true;
    try {
      assert.equal(
        (
          await request("/invoices/templates/global", "SUPER_ADMIN", {
            name: "Fallo",
            isDefault: true,
          })
        ).status,
        500,
      );
      const other = templates.find(
        (row) => row.isGlobal && row.id !== current,
      )!;
      assert.equal(
        (
          await request(
            `/invoices/templates/${other.id}`,
            "SUPER_ADMIN",
            { isDefault: true },
            "PATCH",
          )
        ).status,
        500,
      );
    } finally {
      failTemplate = false;
    }
    assert.equal(templates.find((row) => row.id === current)?.isDefault, true);
    assert.equal(
      templates.filter((row) => row.isGlobal && row.isDefault).length,
      1,
    );
  });
  it("rejects null defaults and caller-supplied legacy content", async () => {
    assert.equal(
      (
        await request("/invoices/templates/global", "SUPER_ADMIN", {
          isDefault: null,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/invoices/templates/global", "SUPER_ADMIN", {
          content: "<script>",
        })
      ).status,
      400,
    );
  });
  it("uses the CUID returned by creation for proof submission and both HTTP review routes", async () => {
    const created = await request(
      "/subscriptions/upgrade-requests",
      "COMPANY_ADMIN",
      { newPlanCode: "PRO", paymentMethod: "YAPE", billingCycle: "YEARLY" },
    );
    assert.equal(created.status, 201);
    const body = (await created.json()) as { requestId: string };
    assert.match(body.requestId, /^cl/);
    assert.equal(
      (
        await request(
          `/subscriptions/upgrade-requests/${body.requestId}/proof`,
          "COMPANY_ADMIN",
          { imageBase64: image },
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          `/platform/upgrade-requests/${body.requestId}/review`,
          "SUPER_ADMIN",
          { status: "APPROVED" },
        )
      ).status,
      201,
    );
    assert.equal(subscriptionCycle, "YEARLY");
    assert.ok(subscriptionEnd!.getTime() - Date.now() > 360 * 86400000);
    assert.equal(
      (
        await request(
          `/subscriptions/upgrade-requests/${body.requestId}/review`,
          "SUPER_ADMIN",
          { status: "APPROVED" },
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await request(
          "/platform/upgrade-requests/bad%20id/review",
          "SUPER_ADMIN",
          { status: "APPROVED" },
        )
      ).status,
      400,
    );
  });
});
