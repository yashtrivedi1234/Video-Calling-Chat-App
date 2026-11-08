const STATE_CACHE = "meetify-push-state";
const USER_KEY = "/__push-user";

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATE_CACHE);
    if (event.data?.type === "BIND_USER" && typeof event.data.userId === "string") {
      await cache.put(USER_KEY, new Response(event.data.userId));
    } else if (event.data?.type === "UNBIND_USER") {
      await cache.delete(USER_KEY);
      const notifications = await self.registration.getNotifications();
      notifications.forEach((notification) => notification.close());
    }
    event.ports?.[0]?.postMessage({ success: true });
  })());
});

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    const cache = await caches.open(STATE_CACHE);
    const binding = await cache.match(USER_KEY);
    if (!binding || typeof data?.userId !== "string" || await binding.text() !== data.userId) return;
    const eventKey = typeof data.id === "string" ? `/__push-events/${encodeURIComponent(data.id)}` : null;
    if (eventKey && await cache.match(eventKey)) return;
    let target;
    try { target = new URL(data.url || "/notifications", self.location.origin); } catch { target = new URL("/notifications", self.location.origin); }
    if (target.origin !== self.location.origin) target = new URL("/notifications", self.location.origin);
    await self.registration.showNotification(typeof data.title === "string" ? data.title : "Meetify", {
      body: typeof data.body === "string" ? data.body : "You have new activity on Meetify.",
      icon: "/notification-icon.svg",
      badge: "/notification-icon.svg",
      tag: data.tag || data.id,
      renotify: false,
      data: { url: target.href, userId: data.userId },
    });
    if (eventKey) await cache.put(eventKey, new Response("seen"));
    const keys = (await cache.keys()).filter((key) => new URL(key.url).pathname.startsWith("/__push-events/"));
    // shortcut: retain the last 100 event IDs; use server receipts for longer replay protection.
    if (keys.length > 100) await cache.delete(keys[0]);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: "MEETIFY_EVENT", tag: data.tag }));
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (target.origin !== self.location.origin) return;
    const cache = await caches.open(STATE_CACHE);
    const binding = await cache.match(USER_KEY);
    if (!binding || await binding.text() !== event.notification.data?.userId) return;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target.href);
      await existing.focus();
    } else {
      await self.clients.openWindow(target.href);
    }
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATE_CACHE);
    if (!await cache.match(USER_KEY)) return;
    if (!event.newSubscription && !event.oldSubscription?.options) return;
    const subscription = event.newSubscription || await self.registration.pushManager.subscribe(event.oldSubscription.options);
    await fetch("/api/notifications/subscriptions", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
  })());
});
