import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import User from "../src/models/User.js";
import FriendRequest from "../src/models/FriendRequest.js";
import { normalizeUsername, USERNAME_PATTERN } from "../src/lib/username.js";

Object.assign(process.env, { STREAM_API_KEY: "test-key", STREAM_API_SECRET: "test-secret", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "" });
const { streamClient } = await import("../src/lib/stream.js");
const { onboard } = await import("../src/controllers/auth.controller.js");
const { searchUsers, checkUsername } = await import("../src/controllers/user.controller.js");
const me = "507f1f77bcf86cd799439011";
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const query = (value) => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value });

beforeEach(() => {
  mock.method(console, "error", () => {});
  mock.method(console, "log", () => {});
  mock.method(User, "init", async () => {});
  mock.method(streamClient, "upsertUser", async () => {});
});
afterEach(() => mock.restoreAll());

test("usernames normalize to lowercase and the sparse unique index leaves legacy profiles valid", async () => {
  assert.equal(normalizeUsername(" Yash.Trivedi_1 "), "yash.trivedi_1");
  for (const invalid of [null, {}, "ab", "x".repeat(31), "two words", "<script>", "a/b"]) assert.equal(USERNAME_PATTERN.test(normalizeUsername(invalid)), false);
  const account = new User({ fullName: "Legacy User", email: "member@example.com", password: "password" });
  assert.equal(account.username, undefined);
  await account.validate();
  account.username = "My.Name";
  await account.validate();
  assert.equal(account.username, "my.name");
  assert.ok(User.schema.indexes().some(([keys, options]) => keys.username === 1 && options.unique && options.sparse));
});

test("social onboarding needs only name and username, preserves existing data and never accepts protected fields", async () => {
  let saved;
  mock.method(User, "findByIdAndUpdate", async (id, update, options) => {
    assert.equal(id, me);
    assert.equal(options.runValidators, true);
    saved = update;
    return { _id: me, friends: ["friend"], nativeLanguage: "hindi", ...update };
  });
  const res = response();
  await onboard({ user: { _id: me }, body: { fullName: "  Yash  ", username: " YASH_1 ", friends: [], password: "hacked", isOnboarded: false } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.username, "yash_1");
  assert.equal(res.body.user.fullName, "Yash");
  assert.deepEqual(res.body.user.friends, ["friend"]);
  assert.equal(res.body.user.nativeLanguage, "hindi");
  assert.equal(saved.friends, undefined);
  assert.equal(saved.password, undefined);
  assert.equal(saved.isOnboarded, true);
  assert.equal(saved.bio, "");
});

test("invalid profile fields cannot reach the database", async () => {
  const update = mock.method(User, "findByIdAndUpdate", async () => assert.fail("Invalid profile saved"));
  for (const body of [null, {}, { fullName: "Name", username: { $ne: null } }, { fullName: " ", username: "valid" }, { fullName: "x".repeat(81), username: "valid" }, { fullName: "Name", username: "valid", bio: "x".repeat(241) }, { fullName: "Name", username: "valid", location: {} }, { fullName: "Name", username: "valid", profilePic: "javascript:alert(1)" }]) {
    const res = response();
    await onboard({ user: { _id: me }, body }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

test("concurrent username conflicts return 409 and a deleted account returns 404", async () => {
  const req = { user: { _id: me }, body: { fullName: "Name", username: "same.name" } };
  mock.method(User, "findByIdAndUpdate", async () => { throw { code: 11000, keyPattern: { username: 1 } }; });
  const conflict = response();
  await onboard(req, conflict);
  assert.equal(conflict.statusCode, 409);
  assert.match(conflict.body.message, /already taken/i);
  mock.method(User, "findByIdAndUpdate", async () => null);
  const removed = response();
  await onboard(req, removed);
  assert.equal(removed.statusCode, 404);
});

test("availability excludes your own handle and rejects malformed values", async () => {
  mock.method(User, "exists", async (filter) => {
    assert.equal(filter.username, "my.name");
    assert.equal(filter._id.$ne, me);
    return null;
  });
  const res = response();
  await checkUsername({ user: { _id: me }, query: { username: " My.Name " } }, res);
  assert.deepEqual(res.body, { username: "my.name", available: true });
  mock.method(User, "exists", async () => ({ _id: "other" }));
  const taken = response();
  await checkUsername({ user: { _id: me }, query: { username: "my.name" } }, taken);
  assert.equal(taken.body.available, false);
  const invalid = response();
  await checkUsername({ user: { _id: me }, query: { username: { $ne: null } } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test("people search bounds results, escapes regex, hides private fields and returns relationship actions", async () => {
  const people = ["friend", "outgoing", "incoming", "new"].map((_id) => ({ _id, fullName: _id, username: `${_id}.user` }));
  mock.method(User, "find", (filter) => {
    assert.equal(filter.isOnboarded, true);
    assert.equal(filter._id.$ne, me);
    assert.equal(filter.$or[0].username.$regex, "Name\\.\\*\\[");
    assert.equal(filter.$or[0].username.$options, "i");
    return {
      select(fields) { assert.equal(fields, "fullName username profilePic bio"); return this; },
      sort() { return this; }, limit(limit) { assert.equal(limit, 20); return this; }, lean: async () => people,
    };
  });
  mock.method(FriendRequest, "find", (filter) => {
    assert.equal(filter.status, "pending");
    assert.equal(filter.$or[0].sender, me);
    return query([{ _id: "request-out", sender: me, recipient: "outgoing" }, { _id: "request-in", sender: "incoming", recipient: me }]);
  });
  const res = response();
  await searchUsers({ user: { _id: me, friends: ["friend"] }, query: { q: " @Name.*[ " } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.users.map((person) => person.relationship), ["friend", "outgoing", "incoming", "none"]);
  assert.equal(res.body.users[2].requestId, "request-in");
  assert.equal(res.body.users[1].requestId, undefined);
});

test("empty searches avoid queries, oversized or structured inputs are rejected and database errors are recoverable", async () => {
  const find = mock.method(User, "find", () => { throw new Error("Unavailable"); });
  for (const q of ["", "  ", "@"]) {
    const res = response();
    await searchUsers({ query: { q } }, res);
    assert.deepEqual(res.body, { users: [] });
  }
  assert.equal(find.mock.callCount(), 0);
  for (const q of [undefined, {}, ["name"], "x".repeat(81)]) {
    const res = response();
    await searchUsers({ query: { q } }, res);
    assert.equal(res.statusCode, 400);
  }
  const failed = response();
  await searchUsers({ user: { _id: me }, query: { q: "name" } }, failed);
  assert.equal(failed.statusCode, 500);
});
