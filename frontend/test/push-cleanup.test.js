import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
const { clearBrowserPush, disableBrowserPush, getPresenceDeviceId, subscribeBrowserPush } = await vite.ssrLoadModule("/src/lib/push.js");
const { axiosInstance } = await vite.ssrLoadModule("/src/lib/axios.js");
after(() => vite.close());

let originals;
let storage;
let unsubscribed;
beforeEach(() => {
  const names = ["window", "navigator", "localStorage", "sessionStorage", "Notification"];
  originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  storage = new Map([["meetifyPushUser", "old-account"], ["meetifyPushEndpoint", "https://fcm.googleapis.com/example"]]);
  unsubscribed = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true, Notification: {}, PushManager: {}, location: { pathname: "/" }, dispatchEvent() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    serviceWorker: { getRegistration: async () => ({
      active: { postMessage() { throw new Error("Worker has stopped"); } },
      pushManager: { getSubscription: async () => ({ unsubscribe: async () => { unsubscribed += 1; } }) },
    }) },
  } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: globalThis.localStorage });
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: { permission: "granted" } });
});
afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

test("logout still unsubscribes and clears account markers when a worker cannot acknowledge", async () => {
  await clearBrowserPush();
  assert.equal(unsubscribed, 1);
  assert.equal(storage.has("meetifyPushUser"), false);
  assert.equal(storage.has("meetifyPushEndpoint"), false);
});

test("disabling push protects the local browser even if the server is unreachable", async () => {
  axiosInstance.defaults.adapter = async (config) => { throw Object.assign(new Error("Server offline"), { config }); };
  await assert.rejects(disableBrowserPush(), /Server offline/);
  assert.equal(unsubscribed, 1);
  assert.equal(storage.get("meetifyPushDisabled"), "true");
  assert.equal(storage.has("meetifyPushUser"), false);
});

test("duplicated tabs do not reuse the copied presence identity", () => {
  storage.set("meetifyPresenceDevice", "copied-from-another-tab");
  const id = getPresenceDeviceId();
  assert.notEqual(id, "copied-from-another-tab");
  assert.equal(getPresenceDeviceId(), id);
  assert.equal(storage.get("meetifyPresenceDevice"), id);
});

test("a changed sign-in cannot bind this browser to a stale account", async () => {
  const commands = [];
  const registration = {
    active: { postMessage(message, ports) { commands.push(message); ports[0].postMessage({ success: true }); } },
    pushManager: { getSubscription: async () => ({ options: {}, endpoint: "https://fcm.googleapis.com/example", toJSON: () => ({}), unsubscribe: async () => { unsubscribed += 1; } }) },
  };
  navigator.serviceWorker.register = async () => registration;
  navigator.serviceWorker.ready = Promise.resolve(registration);
  navigator.serviceWorker.getRegistration = async () => registration;
  axiosInstance.defaults.adapter = async (config) => ({ status: 200, config, data: config.url.endsWith("/config") ? { publicKey: "BA" } : { success: true, userId: "different-account" } });
  await assert.rejects(subscribeBrowserPush("old-account"), /account changed/);
  assert.equal(commands.some((command) => command.type === "BIND_USER"), false);
  assert.equal(unsubscribed, 1);
  assert.equal(storage.has("meetifyPushUser"), false);
});
