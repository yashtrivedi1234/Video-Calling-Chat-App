import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function worker() {
  const handlers = new Map();
  const entries = new Map();
  const notifications = [];
  const opened = [];
  const cacheKey = (key) => typeof key === "string" ? key : new URL(key.url).pathname;
  const cache = {
    match: async (key) => entries.get(cacheKey(key))?.clone(),
    put: async (key, value) => { entries.set(cacheKey(key), value.clone()); },
    delete: async (key) => entries.delete(cacheKey(key)),
    keys: async () => [...entries.keys()].map((key) => new Request(new URL(key, "https://meetify.example"))),
  };
  const self = {
    location: { origin: "https://meetify.example" },
    addEventListener: (name, handler) => handlers.set(name, handler),
    registration: {
      showNotification: async (title, options) => notifications.push({ title, ...options }),
      getNotifications: async () => [],
    },
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) },
  };
  vm.runInNewContext(source, { self, caches: { open: async () => cache }, Response, Request, URL, fetch: async () => ({ ok: true }) });
  return {
    notifications, opened,
    async dispatch(name, event) {
      const pending = [];
      handlers.get(name)({ ...event, waitUntil: (promise) => pending.push(promise) });
      await Promise.all(pending);
    },
  };
}

test("worker delivers an event once, prevents cross-account delivery, and clears the binding on logout", async () => {
  const instance = worker();
  const data = { id: "event-1", userId: "alice", title: "Message", body: "Hello", url: "/chat/bob", tag: "chat" };
  await instance.dispatch("push", { data: { json: () => data } });
  assert.equal(instance.notifications.length, 0);
  await instance.dispatch("message", { data: { type: "BIND_USER", userId: "alice" } });
  await instance.dispatch("push", { data: { json: () => data } });
  await instance.dispatch("push", { data: { json: () => data } });
  assert.equal(instance.notifications.length, 1);
  assert.equal(instance.notifications[0].data.url, "https://meetify.example/chat/bob");
  await instance.dispatch("message", { data: { type: "BIND_USER", userId: "bob" } });
  await instance.dispatch("push", { data: { json: () => ({ ...data, id: "event-2" }) } });
  assert.equal(instance.notifications.length, 1);
  await instance.dispatch("message", { data: { type: "UNBIND_USER" } });
  await instance.dispatch("push", { data: { json: () => ({ ...data, id: "event-3", userId: "bob" }) } });
  assert.equal(instance.notifications.length, 1);
});

test("worker constrains notification links to this site and ignores malformed payloads", async () => {
  const instance = worker();
  await instance.dispatch("message", { data: { type: "BIND_USER", userId: "alice" } });
  await instance.dispatch("push", { data: { json: () => ({ id: "event-1", userId: "alice", title: "Message", body: "Hello", url: "https://attacker.example/" }) } });
  assert.equal(instance.notifications[0].data.url, "https://meetify.example/notifications");
  await instance.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://attacker.example/", userId: "alice" } } });
  assert.equal(instance.opened.length, 0);
  await instance.dispatch("push", { data: { json() { throw new Error("Invalid JSON"); } } });
  assert.equal(instance.notifications.length, 1);
  await instance.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://meetify.example/chat/bob", userId: "alice" } } });
  assert.deepEqual(instance.opened, ["https://meetify.example/chat/bob"]);
  await instance.dispatch("pushsubscriptionchange", { oldSubscription: null, newSubscription: null });
});

test("worker displays every message in the same chat and suppresses a retried delivery", async () => {
  const instance = worker();
  await instance.dispatch("message", { data: { type: "BIND_USER", userId: "alice" } });
  const messages = ["message-1", "message-2", "message-3"].map((id) => ({
    id, userId: "alice", title: "Message from Bob", body: "Hello", url: "/chat/bob", tag: `message:${id}`,
  }));
  for (const message of [...messages, messages[0]]) {
    await instance.dispatch("push", { data: { json: () => message } });
  }
  assert.equal(instance.notifications.length, 3);
  assert.equal(new Set(instance.notifications.map((notification) => notification.tag)).size, 3);
  assert.ok(instance.notifications.every((notification) => notification.data.url === "https://meetify.example/chat/bob"));
});
