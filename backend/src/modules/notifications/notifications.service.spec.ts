import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert";
import { NotFoundException } from "@nestjs/common";
import {
  NotificationsService,
  NotificationType,
} from "./notifications.service";

const prismaWithCreate = () =>
  ({
    notification: {
      create: async (args: any) => ({ id: "n1", ...args.data }),
    },
  }) as any;

describe("NotificationsService markAsRead ownership", () => {
  it("404s when the notification belongs to another user", async () => {
    const prisma = {
      notification: {
        findFirst: async () => null,
        update: async () => ({}),
      },
    } as any;
    const svc = new NotificationsService(prisma);

    await assert.rejects(
      () => svc.markAsRead("n1", "user-b"),
      NotFoundException,
    );
  });

  it("marks as read only a notification owned by the current user", async () => {
    let updateWhere: any;
    const prisma = {
      notification: {
        findFirst: async (args: any) =>
          args.where.id === "n1" && args.where.userId === "user-a"
            ? { id: "n1" }
            : null,
        update: async (args: any) => {
          updateWhere = args.where;
          return { id: "n1", isRead: true };
        },
      },
    } as any;
    const svc = new NotificationsService(prisma);

    const result = await svc.markAsRead("n1", "user-a");
    assert.equal(result.isRead, true);
    assert.deepEqual(updateWhere, { id: "n1" });
  });
});

describe("NotificationsService SSE fan-out", () => {
  const input = {
    userId: "user-a",
    type: NotificationType.GENERAL,
    title: "Hola",
    message: "Mensaje",
  };

  it("emits locally when Redis is not configured", async () => {
    const svc = new NotificationsService(prismaWithCreate());
    const received: unknown[] = [];
    svc.subscribe("user-a", (notification) => received.push(notification));

    await svc.create(input);

    assert.equal(received.length, 1);
    const notification = received[0] as { id: string; title: string };
    assert.equal(notification.id, "n1");
    assert.equal(notification.title, "Hola");
  });

  it("publishes to Redis and delivers to local clients via the pub/sub handler", async () => {
    const published: string[] = [];
    const redis = {
      status: "ready",
      publish: async (_channel: string, payload: string) => {
        published.push(payload);
        return 1;
      },
    };
    const svc = new NotificationsService(prismaWithCreate(), redis as any);
    (svc as any).subscriber = {};

    const received: unknown[] = [];
    svc.subscribe("user-a", (notification) => received.push(notification));

    await svc.create(input);

    assert.equal(published.length, 1);
    assert.equal(received.length, 0);

    (svc as any).onPubSubMessage(published[0]);
    assert.equal(received.length, 1);
  });

  it("falls back to a local emit when the publish fails", async () => {
    const redis = {
      status: "ready",
      publish: async () => {
        throw new Error("redis down");
      },
    };
    const svc = new NotificationsService(prismaWithCreate(), redis as any);
    (svc as any).subscriber = {};

    const received: unknown[] = [];
    svc.subscribe("user-a", (notification) => received.push(notification));

    await svc.create(input);

    assert.equal(received.length, 1);
  });

  it("ignores malformed pub/sub payloads", () => {
    const svc = new NotificationsService(prismaWithCreate());
    const received: unknown[] = [];
    svc.subscribe("user-a", (notification) => received.push(notification));

    (svc as any).onPubSubMessage("not-json");
    (svc as any).onPubSubMessage(JSON.stringify({ userId: "user-a" }));

    assert.equal(received.length, 0);
  });
});
