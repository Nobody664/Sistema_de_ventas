import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("Company notification HTTP audience", () => {
  let app: INestApplication;
  let url: string;
  const queries: Array<{ where: Record<string, unknown> }> = [];
  before(async () => {
    const authentication = {
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const role = request.headers["x-test-role"];
        if (!role) throw new UnauthorizedException();
        request.user = {
          sub: "current-user",
          email: "u@example.invalid",
          companyId: "company",
          companyStatus: "ACTIVE",
          roles: [role],
        };
        return true;
      },
    };
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              findMany: async (query: { where: Record<string, unknown> }) => {
                queries.push(query);
                return [];
              },
            },
          },
        },
        { provide: APP_GUARD, useValue: authentication },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authentication)
      .compile();
    app = module.createNestApplication();
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  after(async () => {
    await app?.close();
  });
  it("rejects guests and operational roles before accessing another person's notifications", async () => {
    assert.equal((await fetch(`${url}/notifications/company`)).status, 401);
    for (const role of ["CASHIER", "MANAGER", "WAREHOUSE", "SUPPORT_ADMIN"])
      assert.equal(
        (
          await fetch(`${url}/notifications/company`, {
            headers: { "x-test-role": role },
          })
        ).status,
        403,
      );
    assert.equal(queries.length, 0);
  });
  it("allows the company administrator and keeps both tenant and company scope in the query", async () => {
    assert.equal(
      (
        await fetch(`${url}/notifications/company?unreadOnly=true`, {
          headers: { "x-test-role": "COMPANY_ADMIN" },
        })
      ).status,
      200,
    );
    assert.deepEqual(queries.at(-1)?.where, {
      companyId: "company",
      scope: "COMPANY",
      isRead: false,
    });
  });
  it("keeps a cashier's personal inbox scoped to their authenticated user", async () => {
    assert.equal(
      (
        await fetch(`${url}/notifications`, {
          headers: { "x-test-role": "CASHIER" },
        })
      ).status,
      200,
    );
    assert.deepEqual(queries.at(-1)?.where, { userId: "current-user" });
  });
});
