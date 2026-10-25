import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { setImmediate } from "node:timers/promises";
import type { Notification } from "@/types/api";
import { useNotificationsStore } from "./notifications-store";

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;
const notification: Notification = {
  id: "notification-1",
  userId: "user-1",
  type: "SYSTEM",
  channel: "IN_APP",
  title: "Aviso",
  message: "Mensaje",
  isRead: false,
  createdAt: new Date(),
};

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;
  constructor() {
    FakeEventSource.instances.push(this);
  }
  close(): void {
    this.closed = true;
  }
}

afterEach(() => {
  useNotificationsStore.getState().reset();
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
  FakeEventSource.instances = [];
});

test("deduplica entregas SSE y no vuelve a contar avisos leídos", () => {
  const store = useNotificationsStore.getState();
  store.addNotification(notification);
  store.addNotification(notification);
  assert.equal(useNotificationsStore.getState().notifications.length, 1);
  assert.equal(useNotificationsStore.getState().unreadCount, 1);
  store.addNotification({ ...notification, isRead: true });
  store.addNotification(notification);
  assert.equal(useNotificationsStore.getState().unreadCount, 0);
  assert.equal(useNotificationsStore.getState().notifications[0].isRead, true);
});

test("dos confirmaciones de lectura descuentan una sola transición", async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  useNotificationsStore.getState().addNotification(notification);
  useNotificationsStore
    .getState()
    .addNotification({ ...notification, id: "n2" });
  await Promise.all([
    useNotificationsStore.getState().markAsRead(notification.id),
    useNotificationsStore.getState().markAsRead(notification.id),
  ]);
  assert.equal(useNotificationsStore.getState().unreadCount, 1);
});

test("una respuesta en vuelo de otra sesión no repuebla el store", async () => {
  let resolveCount!: (response: Response) => void;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      resolveCount = resolve;
    });
  const pending = useNotificationsStore.getState().fetchUnreadCount();
  useNotificationsStore.getState().reset();
  resolveCount(Response.json({ count: 99 }));
  await pending;
  assert.equal(useNotificationsStore.getState().unreadCount, 0);
});

test("reconecta con backoff y recupera lista y contador al abrir", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
  globalThis.fetch = async (input) =>
    Response.json(
      String(input).endsWith("unread-count") ? { count: 8 } : [notification],
    );
  useNotificationsStore.getState().connectToStream();
  FakeEventSource.instances[0].onerror?.();
  context.mock.timers.tick(1000);
  await setImmediate();
  assert.equal(FakeEventSource.instances.length, 2);
  assert.equal(FakeEventSource.instances[0].closed, true);
  FakeEventSource.instances[1].onopen?.();
  await setImmediate();
  assert.equal(useNotificationsStore.getState().isConnected, true);
  assert.equal(useNotificationsStore.getState().notifications.length, 1);
  assert.equal(useNotificationsStore.getState().unreadCount, 8);
});

test("un 403 detiene los reintentos y reset cancela callbacks antiguos", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ message: "Sin permiso" }, { status: 403 });
  };
  useNotificationsStore.getState().connectToStream();
  const old = FakeEventSource.instances[0];
  old.onerror?.();
  context.mock.timers.tick(1000);
  await setImmediate();
  context.mock.timers.tick(60_000);
  await setImmediate();
  assert.equal(requests, 1);
  useNotificationsStore.getState().reset();
  old.onmessage?.({ data: JSON.stringify(notification) });
  assert.equal(useNotificationsStore.getState().notifications.length, 0);
});
