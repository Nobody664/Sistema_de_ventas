import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { StoreAdminContextService } from "./store-admin-context.service";
import { StoreAdminPolicyService } from "./store-admin-policy.service";

function service(options: { membership?: unknown; capabilities?: unknown }) {
  return new StoreAdminContextService(
    {
      membership: {
        findFirst: async () => options.membership ?? null,
      },
    } as never,
    {
      getCapabilities: async () => options.capabilities ?? {},
      hasModule: (_capabilities: unknown, module: string) =>
        module === "storefront",
    } as never,
    new StoreAdminPolicyService(),
  );
}

const membership = {
  id: "membership-1",
  company: {
    id: "company-1",
    name: "Bodega Central",
    slug: "bodega-central",
    timezone: "America/Lima",
    currency: "PEN",
    status: "ACTIVE",
    storefront: {
      enabled: true,
      checkoutEnabled: false,
      title: "  Tienda Central  ",
    },
  },
};

describe("StoreAdminContextService", () => {
  it("resuelve el contexto desde la membresía, no desde datos de la petición", async () => {
    const context = await service({ membership }).resolve({
      sub: "user-1",
      companyId: "company-1",
      roles: ["COMPANY_ADMIN"],
    });
    assert.equal(context.mode, "MANAGE");
    assert.equal(context.company.id, "company-1");
    assert.equal(context.store.title, "Tienda Central");
    assert.equal(context.store.enabled, true);
    assert.equal(context.capabilities.manageSettings, true);
    assert.equal(context.access.attendExistingOrders, true);
  });

  it("degrada a atención restringida cuando el plan no incluye la tienda", async () => {
    const context = await service({ membership }).resolve({
      sub: "user-1",
      companyId: "company-1",
      roles: ["COMPANY_ADMIN"],
    });
    assert.equal(context.mode, "MANAGE");

    const restricted = new StoreAdminContextService(
      {
        membership: {
          findFirst: async () => membership,
        },
      } as never,
      {
        getCapabilities: async () => ({}),
        hasModule: () => false,
      } as never,
      new StoreAdminPolicyService(),
    );
    const result = await restricted.resolve({
      sub: "user-1",
      companyId: "company-1",
      roles: ["COMPANY_ADMIN"],
    });
    assert.equal(result.mode, "CLOSEOUT");
    assert.equal(result.capabilities.viewDashboard, false);
    assert.equal(result.access.attendExistingOrders, true);
  });

  it("no convierte permisos de plataforma en contexto de dueño", async () => {
    const scoped = service({ membership: null });
    await assert.rejects(
      () =>
        scoped.resolve({
          sub: "platform-user",
          companyId: "company-1",
          roles: ["SUPER_ADMIN"],
        }),
      ForbiddenException,
    );
    await assert.rejects(
      () =>
        scoped.resolve({
          sub: "platform-user",
          companyId: null,
          roles: ["SUPER_ADMIN"],
        }),
      ForbiddenException,
    );
  });
});
