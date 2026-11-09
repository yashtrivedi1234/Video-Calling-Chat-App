import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import { createServer } from "vite";
import toast from "react-hot-toast";

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
  appType: "custom",
});
const { axiosInstance } = await vite.ssrLoadModule("/src/lib/axios.js");
const { getAuthUser, login, forgotPassword, resetPassword, searchPeople, checkUsername } = await vite.ssrLoadModule("/src/lib/api.js");
after(() => vite.close());
afterEach(() => { mock.restoreAll(); delete globalThis.window; });

test("a guest opening any auth page gets a silent anonymous session", async () => {
  const notifications = mock.method(toast, "error", () => {});
  axiosInstance.defaults.adapter = async (config) => {
    throw Object.assign(new Error("Unauthorized"), { config, response: { status: 401 } });
  };
  for (const pathname of ["/", "/login", "/signup", "/forgot-password", "/reset-password"]) {
    globalThis.window = { location: { pathname } };
    assert.deepEqual(await getAuthUser(), { user: null });
  }
  assert.equal(notifications.mock.callCount(), 0);
});

test("protected request failures still notify users and server errors remain errors", async () => {
  globalThis.window = { location: { pathname: "/friends" } };
  const notifications = mock.method(toast, "error", () => {});
  mock.method(console, "log", () => {});
  axiosInstance.defaults.adapter = async (config) => {
    throw Object.assign(new Error("Unauthorized"), { config, response: { status: 401 } });
  };
  await assert.rejects(axiosInstance.get("/users/friends"));
  assert.equal(notifications.mock.callCount(), 1);
  assert.equal(notifications.mock.calls[0].arguments[1].id, "session-expired");
  await assert.rejects(axiosInstance.post("/notifications/presence", { online: false }));
  assert.equal(notifications.mock.callCount(), 1);
  globalThis.window.location.pathname = "/login";
  await assert.rejects(login({ email: "member@example.com", password: "wrong" }));
  assert.equal(notifications.mock.callCount(), 1);
  axiosInstance.defaults.adapter = async (config) => {
    throw Object.assign(new Error("Database unavailable"), { config, response: { status: 500 } });
  };
  await assert.rejects(getAuthUser(), /Database unavailable/);
});

test("recovery forms send only email or token and new password to their matching endpoints", async () => {
  const requests = [];
  axiosInstance.defaults.adapter = async (config) => {
    requests.push({ url: config.url, data: JSON.parse(config.data) });
    return { status: 200, data: { message: "OK" }, config };
  };
  await forgotPassword("member@example.com");
  await resetPassword({ token: "a".repeat(64), password: "new-password" });
  assert.deepEqual(requests, [
    { url: "/auth/forgot-password", data: { email: "member@example.com" } },
    { url: "/auth/reset-password", data: { token: "a".repeat(64), password: "new-password" } },
  ]);
});


test("people search and username checks send cancellable query parameters to authenticated endpoints", async () => {
  const requests = [];
  axiosInstance.defaults.adapter = async (config) => {
    requests.push(config);
    return { status: 200, data: config.url.endsWith("search") ? { users: [{ username: "naina.design" }] } : { available: true }, config };
  };
  const controller = new AbortController();
  assert.deepEqual(await searchPeople("@naina.design", controller.signal), [{ username: "naina.design" }]);
  assert.equal((await checkUsername("my.name", controller.signal)).available, true);
  assert.deepEqual(requests.map(({ url, params }) => ({ url, params })), [
    { url: "/users/search", params: { q: "@naina.design" } },
    { url: "/users/username", params: { username: "my.name" } },
  ]);
  assert.ok(requests.every(({ signal }) => signal === controller.signal));
  controller.abort();
  await assert.rejects(searchPeople("old-query", controller.signal), { name: "CanceledError" });
  assert.equal(requests.length, 2);
});
