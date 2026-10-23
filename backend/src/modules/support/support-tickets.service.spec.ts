import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { NotFoundException } from "@nestjs/common";
import { SupportTicketsService, TicketActor } from "./support-tickets.service";

function makeService(prisma: any) {
  const created: any[] = [];
  const notifications = {
    create: async (input: any) => {
      created.push(input);
      return {};
    },
  } as any;
  return {
    svc: new SupportTicketsService(prisma, notifications),
    notifications: created,
  };
}

const companyActor: TicketActor = {
  userId: "u1",
  companyId: "c1",
  isPlatform: false,
};
const platformActor: TicketActor = {
  userId: "admin",
  companyId: null,
  isPlatform: true,
};

describe("SupportTicketsService.create", () => {
  it("sets a priority-based SLA due date and notifies agents", async () => {
    let createdData: any;
    const prisma = {
      supportTicket: {
        create: async ({ data }: any) => {
          createdData = data;
          return { id: "t1", ...data, title: data.title };
        },
      },
      user: {
        findMany: async () => [{ id: "agent1" }],
      },
    };
    const { svc, notifications } = makeService(prisma);

    const before = Date.now();
    await svc.create(companyActor, {
      title: "Ayuda",
      description: "No puedo facturar",
      priority: "URGENT",
    } as any);

    assert.equal(createdData.companyId, "c1");
    assert.equal(createdData.requesterId, "u1");
    assert.equal(createdData.priority, "URGENT");
    assert.ok(createdData.slaDueAt.getTime() >= before + 60 * 60 * 1000);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "agent1");
  });

  it("requires a company for a tenant actor", async () => {
    const { svc } = makeService({});
    await assert.rejects(
      () =>
        svc.create({ userId: "u1", companyId: null, isPlatform: false }, {
          title: "x",
          description: "y",
        } as any),
      /companyId/,
    );
  });
});

describe("SupportTicketsService.findById", () => {
  it("hides tickets from other companies for tenant actors", async () => {
    const prisma = {
      supportTicket: {
        findUnique: async () => ({ id: "t1", companyId: "other" }),
      },
    };
    const { svc } = makeService(prisma);

    await assert.rejects(
      () => svc.findById(companyActor, "t1"),
      NotFoundException,
    );
  });

  it("allows platform actors to read any ticket", async () => {
    const prisma = {
      supportTicket: {
        findUnique: async () => ({ id: "t1", companyId: "other" }),
      },
    };
    const { svc } = makeService(prisma);

    const ticket = await svc.findById(platformActor, "t1");
    assert.equal(ticket.id, "t1");
  });
});

describe("SupportTicketsService.updateStatus", () => {
  it("records history and sets resolvedAt on RESOLVED", async () => {
    let historyData: any;
    let updateData: any;
    const prisma = {
      supportTicket: {
        findUnique: async () => ({
          id: "t1",
          companyId: "c1",
          status: "OPEN",
          resolvedAt: null,
          closedAt: null,
          firstResponseAt: null,
        }),
      },
      $transaction: async (fn: any) =>
        fn({
          supportTicketStatusHistory: {
            create: async ({ data }: any) => {
              historyData = data;
              return data;
            },
          },
          supportTicket: {
            update: async ({ data }: any) => {
              updateData = data;
              return { id: "t1", ...data };
            },
          },
        }),
    };
    const { svc } = makeService(prisma);

    const result = await svc.updateStatus(platformActor, "t1", {
      status: "RESOLVED",
    });

    assert.equal(historyData.fromStatus, "OPEN");
    assert.equal(historyData.toStatus, "RESOLVED");
    assert.ok(updateData.resolvedAt instanceof Date);
    assert.equal(result.status, "RESOLVED");
  });
});
