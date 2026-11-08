import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
const { connectNotifications } = await vite.ssrLoadModule("/src/lib/notifications.js");
const { axiosInstance } = await vite.ssrLoadModule("/src/lib/axios.js");
after(() => vite.close());

let originals, streams, banners, activity, requests, storage, handlers, cleanup;
const event = (overrides = {}) => ({ id: "message-1", receipt: "12345678-1234-1234-1234-123456789abc", userId: "alice", title: "Bob", body: "Private message text", type: "message.new", url: "/chat/bob", tag: "message:1", ...overrides });
const emit = (data) => streams[0].onmessage({ data: typeof data === "string" ? data : JSON.stringify(data) });
const settled = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  originals = ["window", "document", "navigator", "localStorage"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  streams = []; banners = []; activity = []; requests = []; handlers = new Map();
  storage = new Map([["meetifyPushUser", "alice"], ["meetifyPushEndpoint", "https://fcm.googleapis.com/device-a"]]);
  class EventSource {
    constructor(url, options) { this.url = url; this.options = options; streams.push(this); }
    close() { this.closed = true; }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: { EventSource, location: { origin: "https://meetify.example", pathname: "/" } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { visibilityState: "visible", hasFocus: () => true } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: (name) => handlers.delete(name) } } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key) => storage.get(key) || null } });
  axiosInstance.defaults.adapter = async (config) => { requests.push({ url: config.url, body: JSON.parse(config.data) }); return { status: 204, data: "", config }; };
  cleanup = connectNotifications("alice", { onNotification: (notification) => banners.push(notification), onActivity: (notification) => activity.push(notification) });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

test("a focused app shows a private in-app alert and acknowledges only its browser endpoint", async () => {
  emit(event()); await settled();
  assert.equal(streams[0].options.withCredentials, true);
  assert.equal(banners.length, 1);
  assert.equal(banners[0].title, "Bob");
  assert.equal(banners[0].body, "Sent you a message.");
  assert.equal(banners[0].url, "/chat/bob");
  assert.equal(requests[0].body.endpoint, storage.get("meetifyPushEndpoint"));
});

test("the open chat stays quiet while its event is acknowledged", async () => {
  window.location.pathname = "/chat/bob";
  emit(event()); await settled();
  assert.equal(banners.length, 0);
  assert.equal(requests.length, 1);
  assert.equal(activity.length, 1);
});

test("background and unfocused tabs do not acknowledge events so native push remains available", async () => {
  document.visibilityState = "hidden"; emit(event());
  document.visibilityState = "visible"; document.hasFocus = () => false; emit(event({ id: "message-2" }));
  await settled();
  assert.equal(banners.length, 0);
  assert.equal(requests.length, 0);
});

test("retrying a message acknowledges it again without repeating the banner", async () => {
  emit(event()); emit(event({ receipt: "22345678-1234-1234-1234-123456789abc" })); await settled();
  assert.equal(banners.length, 1);
  assert.equal(requests.length, 2);
  handlers.get("message")({ data: { type: "MEETIFY_EVENT", id: "message-2", userId: "alice" } });
  emit(event({ id: "message-2" })); await settled();
  assert.equal(banners.length, 1);
  assert.equal(requests.length, 3);
});

test("malformed, other-account and external-link events cannot show an alert or be acknowledged", async () => {
  for (const data of ["bad JSON", "null", event({ userId: "bob" }), event({ url: "https://attacker.example" }), event({ receipt: "invalid" })]) emit(data);
  await settled();
  assert.equal(banners.length, 0);
  assert.equal(activity.length, 0);
  assert.equal(requests.length, 0);
});

test("foreground alerts also work without browser push permission and cleanup rejects queued events", async () => {
  storage.clear(); emit(event()); await settled();
  assert.equal(banners.length, 1);
  assert.equal(requests[0].body.endpoint, null);
  cleanup(); emit(event({ id: "message-2" })); await settled();
  assert.equal(streams[0].closed, true);
  assert.equal(handlers.size, 0);
  assert.equal(banners.length, 1);
  assert.equal(requests.length, 1);
});
