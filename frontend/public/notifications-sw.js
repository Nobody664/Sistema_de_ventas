self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    return;
  }
  if (!data || typeof data.title !== "string" || typeof data.body !== "string")
    return;
  event.waitUntil(
    self.registration.showNotification(data.title.slice(0, 100), {
      body: data.body.slice(0, 300),
      tag:
        typeof data.tag === "string"
          ? data.tag.slice(0, 128)
          : "ventas-notification",
      data: { url: "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL("/notifications", self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
