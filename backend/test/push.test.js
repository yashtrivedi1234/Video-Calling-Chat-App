import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { createECDH, createHmac, randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import https from "node:https";
import ece from "http_ece";
import { generateVAPIDKeys } from "web-push";
import User from "../src/models/User.js";
import PushSubscription from "../src/models/PushSubscription.js";
import Presence from "../src/models/Presence.js";
import FriendRequest from "../src/models/FriendRequest.js";

const vapid = generateVAPIDKeys();
Object.assign(process.env, {
  STREAM_API_KEY: "push-test-key", STREAM_API_SECRET: "push-test-secret",
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: "mailto:test@example.com",
});
const { sendPush, validPushSubscription } = await import("../src/lib/push.js");
const { streamWebhook, subscribePush, unsubscribePush, reportTyping, reportCall, reportPresence } = await import("../src/controllers/notification.controller.js");
const { syncPresence, expirePresence, PRESENCE_LEASE_MS } = await import("../src/lib/presence.js");
const { streamClient } = await import("../src/lib/stream.js");
const { configurePushWebhook } = await import("../scripts/configure-push.js");
const { acceptFriendRequest } = await import("../src/controllers/user.controller.js");

const actorId = "507f1f77bcf86cd799439011";
const recipientId = "507f1f77bcf86cd799439012";
const strangerId = "507f1f77bcf86cd799439013";
const channelId = [actorId, recipientId].sort().join("-");
let subscriptions;
let packets;
let responseStatus;
let curve;
const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const query = (value) => ({ select: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const request = (body, user = { _id: actorId, fullName: "Alice", friends: [recipientId] }) => ({ body, user });
const packetData = (packet = packets[0]) => JSON.parse(ece.decrypt(packet.body, { version: "aes128gcm", privateKey: curve, authSecret: subscriptions[0].keys.auth }).toString());
const webhookRequest = (event) => {
  const body = Buffer.from(JSON.stringify(event));
  const signature = createHmac("sha256", process.env.STREAM_API_SECRET).update(body).digest("hex");
  return { body, get: (name) => name === "x-signature" ? signature : undefined };
};

beforeEach(() => {
  curve = createECDH("prime256v1");
  curve.generateKeys();
  subscriptions = [{ _id: "subscription-1", user: recipientId, endpoint: "https://fcm.googleapis.com/fcm/send/test-device", keys: { p256dh: curve.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } }];
  packets = [];
  responseStatus = 201;
  mock.method(console, "error", () => {});
  mock.method(PushSubscription, "find", async ({ user }) => subscriptions.filter((item) => user.$in.map(String).includes(item.user)));
  mock.method(PushSubscription, "deleteOne", async () => ({ deletedCount: 1 }));
  mock.method(User, "findById", () => query({ _id: actorId, fullName: "Alice", friends: [recipientId] }));
  mock.method(https, "request", (options, callback) => {
    const output = new EventEmitter();
    const chunks = [];
    output.write = (chunk) => chunks.push(chunk);
    output.end = () => {
      packets.push({ options, body: Buffer.concat(chunks) });
      queueMicrotask(() => {
        const incoming = new EventEmitter();
        incoming.statusCode = responseStatus;
        incoming.headers = {};
        callback(incoming);
        incoming.emit("end");
      });
    };
    return output;
  });
});
afterEach(() => mock.restoreAll());

test("subscription validation accepts real browser keys and rejects private or spoofed endpoints", () => {
  const valid = subscriptions[0];
  assert.equal(validPushSubscription(valid), true);
  for (const endpoint of ["http://fcm.googleapis.com/x", "https://127.0.0.1/x", "https://[::1]/x", "https://fcm.googleapis.com.attacker.example/x", "https://user:password@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"]) {
    assert.equal(validPushSubscription({ ...valid, endpoint }), false);
  }
  for (const endpoint of ["https://updates.push.services.mozilla.com/wpush/v2/example", "https://web.push.apple.com/example", "https://foo.notify.windows.com/example"]) {
    assert.equal(validPushSubscription({ ...valid, endpoint }), true);
  }
  assert.equal(validPushSubscription({ ...valid, keys: { ...valid.keys, auth: "bad" } }), false);
  assert.equal(validPushSubscription({ ...valid, keys: { ...valid.keys, p256dh: Buffer.alloc(65).toString("base64url") } }), false);
});

test("push encrypts payloads, binds them to the recipient, and does not broadcast", async () => {
  assert.equal(await sendPush([recipientId], { id: "event-1", title: "Message", body: "Hello", url: `/chat/${actorId}`, tag: "message" }), true);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].options.hostname, "fcm.googleapis.com");
  assert.equal(packets[0].body.includes(Buffer.from("Hello")), false);
  assert.equal(packetData().userId, recipientId);
  assert.equal(packetData().body, "Hello");
  await sendPush([strangerId], { title: "Private", body: "No broadcast", url: "/" });
  assert.equal(packets.length, 1);
});

test("expired subscriptions are removed while transient push failures remain retryable", async () => {
  responseStatus = 410;
  assert.equal(await sendPush([recipientId], { title: "Event", body: "Expired", url: "/" }), true);
  assert.equal(PushSubscription.deleteOne.mock.callCount(), 1);
  responseStatus = 503;
  assert.equal(await sendPush([recipientId], { title: "Event", body: "Retry", url: "/" }), false);
  assert.equal(PushSubscription.deleteOne.mock.callCount(), 1);
});

test("subscription ownership comes from authentication and deletion is scoped to the current user", async () => {
  mock.method(PushSubscription, "exists", async () => false);
  mock.method(PushSubscription, "countDocuments", async () => 0);
  mock.method(PushSubscription, "findOneAndUpdate", async () => ({}));
  const reply = res();
  await subscribePush(request({ ...subscriptions[0], user: strangerId }), reply);
  assert.equal(reply.statusCode, 201);
  assert.equal(reply.body.userId, actorId);
  assert.equal(PushSubscription.findOneAndUpdate.mock.calls[0].arguments[1].$set.user, actorId);
  await unsubscribePush(request({ endpoint: subscriptions[0].endpoint }), res());
  assert.equal(PushSubscription.deleteOne.mock.calls[0].arguments[0].user, actorId);
  mock.method(PushSubscription, "countDocuments", async () => 10);
  const full = res();
  await subscribePush(request(subscriptions[0]), full);
  assert.equal(full.statusCode, 400);
});

test("webhooks reject forged bodies and target only unmuted friends in the signed channel", async () => {
  const event = { type: "message.new", cid: `messaging:${channelId}`, user: { id: actorId }, message: { text: "Hello" }, members: [{ user_id: actorId }, { user_id: recipientId }, { user_id: strangerId }] };
  const forged = webhookRequest(event);
  forged.get = () => "invalid";
  const rejected = res();
  await streamWebhook(forged, rejected);
  assert.equal(rejected.statusCode, 401);
  assert.equal(packets.length, 0);
  const accepted = res();
  await streamWebhook(webhookRequest(event), accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(packets.length, 1);
  assert.equal(packetData().body, "Hello");
  const firstEventId = packetData().id;
  await streamWebhook(webhookRequest(event), res());
  assert.equal(packetData(packets[1]).id, firstEventId);
  event.members[1].notifications_muted = true;
  await streamWebhook(webhookRequest(event), res());
  assert.equal(packets.length, 2);
});

test("read receipts, reactions and call invitations have the correct routes and safe metadata", async () => {
  const base = { cid: `messaging:${channelId}`, user: { id: actorId }, members: [{ user_id: actorId }, { user_id: recipientId }] };
  for (const type of ["message.read", "message.updated", "message.deleted", "reaction.new", "reaction.deleted"]) {
    await streamWebhook(webhookRequest({ ...base, type }), res());
    assert.equal(packetData(packets.at(-1)).url, `/chat/${actorId}`);
  }
  await streamWebhook(webhookRequest({ ...base, type: "message.new", message: { meetify_event: "call.invite", call_id: channelId, text: "Join" } }), res());
  assert.equal(packetData(packets.at(-1)).url, `/call/${channelId}`);
  assert.equal(packetData(packets.at(-1)).title, "Video call invitation");
  assert.equal(packets.at(-1).options.headers.TTL, 60);
});

test("typing and call activity cannot target strangers or impersonate another call participant", async () => {
  await reportTyping(request({ recipientId, type: "typing.start" }), res());
  assert.match(packetData().body, /Alice is typing/);
  assert.equal(packets[0].options.headers.TTL, 15);
  const denied = res();
  await reportTyping(request({ recipientId: strangerId, type: "typing.stop" }), denied);
  assert.equal(denied.statusCode, 403);
  await reportCall(request({ callId: channelId, type: "call.joined" }), res());
  assert.match(packetData(packets.at(-1)).body, /joined/);
  const unrelated = res();
  await reportCall(request({ callId: `${recipientId}-${strangerId}`, type: "call.left" }), unrelated);
  assert.equal(unrelated.statusCode, 403);
});

test("presence only notifies on changes and keeps a user online while another device is active", async () => {
  let online = true;
  let saved = false;
  mock.method(Presence, "exists", async () => online);
  mock.method(User, "findOneAndUpdate", (filter, update) => {
    if (saved === update.$set.presenceOnline) return query(null);
    saved = update.$set.presenceOnline;
    return query({ _id: actorId, fullName: "Alice", friends: [recipientId] });
  });
  await syncPresence(actorId);
  await syncPresence(actorId);
  assert.equal(packets.length, 1);
  assert.match(packetData().body, /online/);
  mock.method(Presence, "deleteOne", async () => ({}));
  await reportPresence(request({ userId: actorId, deviceId: "12345678-1234-1234-1234-123456789abc", online: false }), res());
  assert.equal(packets.length, 1);
  online = false;
  mock.method(Presence, "find", () => query([{ user: actorId }]));
  mock.method(Presence, "deleteMany", async (filter) => { assert.ok(filter.lastSeenAt.$lte <= new Date(Date.now() - PRESENCE_LEASE_MS)); });
  await expirePresence();
  assert.equal(packets.length, 2);
  assert.match(packetData(packets[1]).body, /offline/);
});

test("webhook setup preserves existing destinations and handles repeat configuration without duplicates", async () => {
  let hooks = [{ hook_type: "webhook", enabled: true, webhook_url: "https://other.example/events", event_types: ["message.new"] }];
  mock.method(streamClient, "getAppSettings", async () => ({ app: { event_hooks: hooks } }));
  mock.method(streamClient, "updateAppSettings", async (settings) => { hooks = settings.event_hooks; });
  const target = "https://meetify.example/api/notifications/stream-webhook";
  await configurePushWebhook(target);
  await configurePushWebhook(target);
  assert.equal(hooks.length, 2);
  assert.equal(hooks[0].webhook_url, "https://other.example/events");
  assert.ok(hooks[1].event_types.includes("message.read"));
  await assert.rejects(configurePushWebhook("http://localhost/"));
});

test("retrying an accepted friend request repairs both friend lists and reuses notification identities", async () => {
  const friendRequest = { _id: "507f1f77bcf86cd799439014", sender: recipientId, recipient: actorId, status: "accepted", save: async () => {} };
  mock.method(FriendRequest, "findById", async () => friendRequest);
  mock.method(User, "findByIdAndUpdate", async () => ({}));
  const req = { ...request({}), params: { id: friendRequest._id } };
  await acceptFriendRequest(req, res());
  await new Promise((resolve) => setImmediate(resolve));
  await acceptFriendRequest(req, res());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(User.findByIdAndUpdate.mock.callCount(), 4);
  assert.equal(packets.length, 2);
  assert.equal(packetData(packets[0]).id, packetData(packets[1]).id);
});
