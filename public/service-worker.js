self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() || {};
  const title = data.title || "Padel Match Manager";
  const options: NotificationOptions = {
    body: data.body || "",
    icon: "/icons.svg",
    badge: "/icons.svg",
    tag: data.tag || "default",
    data: data.data || {},
    actions: data.actions || [],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ((client as WindowClient).url === url && "focus" in client) {
          return (client as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
