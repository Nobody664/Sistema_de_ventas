import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import { AuditService } from "@/common/services/audit.service";
import { SubscriptionLimitService } from "@/common/guards/subscription-limit.service";
import { PrismaService } from "@/database/prisma/prisma.service";
import { EmployeesService } from "./employees.service";

function fixture(failUpdate = false) {
  const membership = { role: "MANAGER", isActive: true };
  let revocations = 0;
  const employee = {
    id: "employee",
    userId: "user",
    companyId: "company",
    role: "MANAGER",
    isActive: true,
    phone: null,
  };
  const tx = {
    membership: {
      findUnique: async () => ({ ...membership }),
      count: async () => 1,
      update: async ({
        data,
      }: {
        data: { role?: string; isActive?: boolean };
      }) => {
        if (data.role !== undefined) membership.role = data.role;
        if (data.isActive !== undefined) membership.isActive = data.isActive;
        return { count: 1 };
      },
    },
    refreshToken: {
      updateMany: async () => {
        revocations++;
        return { count: 1 };
      },
    },
    employee: {
      update: async () => {
        if (failUpdate) throw new Error("employee write failed");
        return employee;
      },
    },
  };
  const prisma = {
    employee: { findFirst: async () => employee },
    $transaction: async <T>(
      work: (client: typeof tx) => Promise<T>,
    ): Promise<T> => {
      const before = { ...membership };
      const beforeRevocations = revocations;
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(membership, before);
        revocations = beforeRevocations;
        throw error;
      }
    },
  };
  const service = new EmployeesService(
    prisma as unknown as PrismaService,
    {} as SubscriptionLimitService,
    { log: async () => undefined } as unknown as AuditService,
  );
  return {
    membership,
    service,
    get revocations() {
      return revocations;
    },
  };
}

describe("Employee permission synchronization", () => {
  it("updates the real membership role and revokes existing tenant sessions", async () => {
    const value = fixture();
    await value.service.update("company", "employee", { role: "CASHIER" });
    assert.equal(value.membership.role, "CASHIER");
    assert.equal(value.revocations, 1);
  });

  it("deactivates the membership when an employee is deactivated", async () => {
    const value = fixture();
    await value.service.update("company", "employee", { isActive: false });
    assert.equal(value.membership.isActive, false);
    assert.equal(value.revocations, 1);
  });

  it("does not leave permissions partially updated when the employee write fails", async () => {
    const value = fixture(true);
    await assert.rejects(
      value.service.update("company", "employee", {
        role: "CASHIER",
        isActive: false,
      }),
      /employee write failed/,
    );
    assert.deepEqual(value.membership, { role: "MANAGER", isActive: true });
    assert.equal(value.revocations, 0);
  });

  it("does not revoke sessions for unrelated profile edits", async () => {
    const value = fixture();
    await value.service.update("company", "employee", { phone: "123456789" });
    assert.equal(value.revocations, 0);
  });

  it("does not remove the last active administrator while synchronizing roles", async () => {
    const value = fixture();
    value.membership.role = "COMPANY_ADMIN";
    await assert.rejects(
      value.service.update("company", "employee", { role: "CASHIER" }),
      ConflictException,
    );
    assert.equal(value.membership.role, "COMPANY_ADMIN");
    assert.equal(value.revocations, 0);
  });
});
