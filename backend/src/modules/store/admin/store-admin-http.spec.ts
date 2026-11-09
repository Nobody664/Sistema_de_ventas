import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { RolesGuard } from "@/common/guards/roles.guard";
import { PermissionsGuard } from "@/common/guards/permissions.guard";
import { StoreCloseoutGuard } from "../store-closeout.guard";
import { StorePrivateInterceptor } from "../store-private.interceptor";
import { StoreAdminWorkspaceController } from "./store-admin.controller";
import { StoreAdminContextService } from "./store-admin-context.service";
import { StoreAdminDashboardService } from "./store-admin-dashboard.service";
import { StoreAdminContext } from "./store-admin-policy.service";

const manageContext: StoreAdminContext = {
  mode: "MANAGE",
  company: {
    id: "company",
    name: "Bodega",
    slug: "bodega",
    timezone: "America/Lima",
    currency: "PEN",
    status: "ACTIVE",
  },
  store: {
    title: "Bodega",
    slug: "bodega",
    enabled: true,
    checkoutEnabled: true,
  },
  capabilities: {
    viewDashboard: true,
    manageOrders: true,
    managePayments: true,
    manageCatalog: true,
    manageCustomers: true,
    manageSettings: true,
    managePaymentsConfig: true,
    manageShippingConfig: true,
    manageRules: true,
    attendExistingOrders: true,
  },
  access: { attendExistingOrders: true },
  generatedAt: "2026-11-08T12:00:00.000Z",
};

describe("Store admin context HTTP", () => {
  let app: INestApplication;
  let url: string;

  before(async () => {
    const authentication = {
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const role = request.headers["x-test-role"];
        if (!role) throw new UnauthorizedException();
        const user = request.headers["x-test-user"];
        request.user = {
          sub: user ?? "admin-user",
          email: "admin@example.invalid",
          companyId:
            request.headers["x-test-company"] === "none" ? null : "company",
          companyStatus: "ACTIVE",
          roles: [role],
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [StoreAdminWorkspaceController],
      providers: [
        StorePrivateInterceptor,
        StoreCloseoutGuard,
        {
          provide: StoreAdminContextService,
          useValue: {
            resolve: async (user: { sub: string }) =>
              user.sub === "restricted"
                ? {
                    ...manageContext,
                    mode: "CLOSEOUT",
                    capabilities: {
                      ...manageContext.capabilities,
                      viewDashboard: false,
                    },
                  }
                : manageContext,
          },
        },
        {
          provide: StoreAdminDashboardService,
          useValue: {
            get: async () => ({ range: { fromKey: "2026-11-02" } }),
          },
        },
        { provide: APP_GUARD, useValue: authentication },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });

  after(async () => {
    await app?.close();
  });

  it("rechaza invitados y roles operativos", async () => {
    assert.equal((await fetch(`${url}/store-admin/context`)).status, 401);
    assert.equal(
      (
        await fetch(`${url}/store-admin/context`, {
          headers: { "x-test-role": "CASHIER" },
        })
      ).status,
      403,
    );
  });

  it("no convierte a un administrador global sin membresía en dueño", async () => {
    assert.equal(
      (
        await fetch(`${url}/store-admin/context`, {
          headers: { "x-test-role": "SUPER_ADMIN" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${url}/store-admin/context`, {
          headers: {
            "x-test-role": "SUPER_ADMIN",
            "x-test-company": "none",
          },
        })
      ).status,
      403,
    );
  });

  it("expone contexto y dashboard al administrador de la empresa", async () => {
    const context = await fetch(`${url}/store-admin/context`, {
      headers: { "x-test-role": "COMPANY_ADMIN" },
    });
    assert.equal(context.status, 200);
    assert.equal((await context.json()).company.id, "company");

    const dashboard = await fetch(`${url}/store-admin/dashboard`, {
      headers: { "x-test-role": "COMPANY_ADMIN" },
    });
    assert.equal(dashboard.status, 200);
    assert.equal((await dashboard.json()).range.fromKey, "2026-11-02");
  });

  it("bloquea el dashboard cuando el contexto está restringido", async () => {
    assert.equal(
      (
        await fetch(`${url}/store-admin/dashboard`, {
          headers: {
            "x-test-role": "COMPANY_ADMIN",
            "x-test-user": "restricted",
          },
        })
      ).status,
      403,
    );
  });
});
