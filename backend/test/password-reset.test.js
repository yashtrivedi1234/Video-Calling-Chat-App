import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../src/models/User.js";
import { protectRoute } from "../src/middlewares/auth.middlewares.js";

Object.assign(process.env, {
  STREAM_API_KEY: "test-key",
  STREAM_API_SECRET: "test-secret",
  JWT_SECRET_KEY: "test-jwt-secret",
  EMAIL_USER: "sender@example.com",
  EMAIL_PASS: "test-app-password",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  CLIENT_URL: "https://meetify.example.com",
});
const { forgotPassword, resetPassword, login } = await import("../src/controllers/auth.controller.js");

let account;
let messages;
const response = () => ({
  statusCode: 200,
  headersSent: false,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = JSON.parse(JSON.stringify(body)); this.headersSent = true; return this; },
  cookie(name, value, options) { this.cookieValue = value; this.cookieOptions = options; return this; },
  clearCookie(name, options) { this.clearedCookie = name; this.cookieOptions = options; return this; },
});
const query = (value) => ({ select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const hash = (token) => createHash("sha256").update(token).digest("hex");
const resetToken = () => new URL(messages.at(-1).text.match(/https:\/\/\S+/)[0]).hash.slice(1);

beforeEach(async () => {
  process.env.EMAIL_PASS = "test-app-password";
  process.env.CLIENT_URL = "https://meetify.example.com";
  account = { _id: "507f1f77bcf86cd799439011", email: "member@example.com", password: await bcrypt.hash("old-password", 4), passwordVersion: 0 };
  messages = [];
  mock.method(console, "error", () => {});
  mock.method(nodemailer, "createTransport", (options) => {
    assert.equal(options.service, "gmail");
    assert.equal(options.auth.user, "sender@example.com");
    assert.equal(options.auth.pass, "test-app-password");
    return { sendMail: async (message) => { messages.push(message); return { accepted: [message.to] }; } };
  });
  mock.method(User, "findOneAndUpdate", (filter, update) => {
    if (filter.email) {
      if (filter.email !== account.email || (account.passwordResetExpires && account.passwordResetExpires > filter.$or[1].passwordResetExpires.$lte)) return query(null);
    } else if (filter.passwordResetToken !== account.passwordResetToken || !(account.passwordResetExpires > filter.passwordResetExpires.$gt)) {
      return query(null);
    }
    Object.assign(account, update.$set);
    for (const key of Object.keys(update.$unset || {})) delete account[key];
    if (update.$inc) account.passwordVersion += update.$inc.passwordVersion;
    return query(User.hydrate(account));
  });
  mock.method(User, "updateOne", async (filter, update) => {
    if (filter.passwordResetToken === account.passwordResetToken) {
      for (const key of Object.keys(update.$unset)) delete account[key];
    }
  });
  mock.method(User, "findOne", ({ email }) => query(email === account.email ? User.hydrate(account) : null));
  mock.method(User, "findById", () => query(User.hydrate(account)));
});
afterEach(() => mock.restoreAll());

test("forgot password sends a hashed, expiring token only to the account email and throttles resends", async () => {
  const known = response();
  await forgotPassword({ body: { email: account.email } }, known);
  assert.equal(known.statusCode, 200);
  const token = resetToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(account.passwordResetToken, hash(token));
  assert.ok(account.passwordResetExpires > new Date(Date.now() + 14 * 60 * 1000));
  assert.equal(messages[0].to, account.email);
  assert.deepEqual(messages[0].from, { name: "Meetify", address: "sender@example.com" });
  assert.ok(!JSON.stringify(known.body).includes(token));

  const unknown = response();
  await forgotPassword({ body: { email: "unknown@example.com" } }, unknown);
  assert.deepEqual(unknown.body, known.body);
  await forgotPassword({ body: { email: account.email } }, response());
  assert.equal(messages.length, 1);

  account.passwordResetExpires = new Date(Date.now() + 13 * 60 * 1000);
  await forgotPassword({ body: { email: account.email } }, response());
  assert.equal(messages.length, 2);
  assert.notEqual(resetToken(), token);
  assert.equal(account.passwordResetToken, hash(resetToken()));
  const replaced = response();
  await resetPassword({ body: { token, password: "new-password" } }, replaced);
  assert.equal(replaced.statusCode, 400);
});

test("reset consumes a token atomically, hashes the password, and rejects replay", async () => {
  await forgotPassword({ body: { email: account.email } }, response());
  const token = resetToken();
  const results = [response(), response()];
  await Promise.all(results.map((res) => resetPassword({ body: { token, password: "new-password" } }, res)));
  assert.deepEqual(results.map((res) => res.statusCode).sort(), [200, 400]);
  assert.equal(await bcrypt.compare("new-password", account.password), true);
  assert.equal(await bcrypt.compare("old-password", account.password), false);
  assert.equal(account.passwordResetToken, undefined);
  assert.equal(account.passwordResetExpires, undefined);
  assert.equal(account.passwordVersion, 1);
  assert.equal(results.find((res) => res.statusCode === 200).clearedCookie, "jwt");
});

test("expired links, malformed input, and oversized UTF-8 passwords cannot change an account", async () => {
  await forgotPassword({ body: { email: account.email } }, response());
  const token = resetToken();
  const originalPassword = account.password;
  account.passwordResetExpires = new Date(Date.now() - 1);
  for (const body of [{ token, password: "new-password" }, { token: "bad", password: "new-password" }, { token, password: "short" }, { token, password: "😀".repeat(19) }, { token, password: { $ne: null } }]) {
    const res = response();
    await resetPassword({ body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(account.password, originalPassword);
  }
  for (const email of [null, {}, "invalid", "a".repeat(255) + "@example.com"]) {
    const res = response();
    await forgotPassword({ body: { email } }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("reset revokes old sessions and a new login works without exposing password hashes", async () => {
  const oldSession = jwt.sign({ userId: account._id }, process.env.JWT_SECRET_KEY);
  await forgotPassword({ body: { email: account.email } }, response());
  await resetPassword({ body: { token: resetToken(), password: "new-password" } }, response());
  const denied = response();
  await protectRoute({ cookies: { jwt: oldSession } }, denied, () => assert.fail("Old session was accepted"));
  assert.equal(denied.statusCode, 401);

  const signedIn = response();
  await login({ body: { email: account.email, password: "new-password" } }, signedIn);
  assert.equal(signedIn.statusCode, 200);
  assert.equal(signedIn.body.user.password, undefined);
  assert.equal(jwt.verify(signedIn.cookieValue, process.env.JWT_SECRET_KEY).passwordVersion, 1);
  let accepted = false;
  await protectRoute({ cookies: { jwt: signedIn.cookieValue } }, response(), () => { accepted = true; });
  assert.equal(accepted, true);
  const oldPassword = response();
  await login({ body: { email: account.email, password: "old-password" } }, oldPassword);
  assert.equal(oldPassword.statusCode, 401);
});

test("expired JWTs return 401 and recovery fields are excluded by default", async () => {
  const res = response();
  const expired = jwt.sign({ userId: account._id }, process.env.JWT_SECRET_KEY, { expiresIn: -1 });
  await protectRoute({ cookies: { jwt: expired } }, res, () => assert.fail("Expired token accepted"));
  assert.equal(res.statusCode, 401);
  for (const field of ["password", "passwordResetToken", "passwordResetExpires"]) assert.equal(User.schema.path(field).options.select, false);
});

test("missing configuration is explicit and delivery failure removes unusable links", async () => {
  delete process.env.EMAIL_PASS;
  const missing = response();
  await forgotPassword({ body: { email: account.email } }, missing);
  assert.equal(missing.statusCode, 503);
  assert.equal(messages.length, 0);
  process.env.EMAIL_PASS = "test-app-password";
  mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => { throw Object.assign(new Error("SMTP unavailable"), { code: "ECONNECTION" }); },
  }));
  const failed = response();
  await forgotPassword({ body: { email: account.email } }, failed);
  assert.equal(failed.statusCode, 200);
  assert.equal(account.passwordResetToken, undefined);
});

test("delivery cleanup cannot remove a newer reset link", async () => {
  mock.method(nodemailer, "createTransport", () => ({
    sendMail: async () => {
      account.passwordResetToken = "newer-token-hash";
      throw Object.assign(new Error("SMTP unavailable"), { code: "ECONNECTION" });
    },
  }));
  await forgotPassword({ body: { email: account.email } }, response());
  assert.equal(account.passwordResetToken, "newer-token-hash");
});
