import { ECDH, randomUUID } from "node:crypto";
import * as webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

export function validPushSubscription(value) {
  try {
    if (typeof value?.endpoint !== "string" || value.endpoint.length > 2048) return false;
    const url = new URL(value.endpoint);
    // Browser-provided URLs must never turn the push sender into an arbitrary HTTP proxy.
    const allowedHost = url.hostname === "fcm.googleapis.com" || url.hostname.endsWith(".push.services.mozilla.com") || url.hostname.endsWith(".notify.windows.com") || url.hostname === "web.push.apple.com" || url.hostname.endsWith(".web.push.apple.com");
    if (url.protocol !== "https:" || !allowedHost || url.username || url.password || (url.port && url.port !== "443")) return false;
    for (const [key, length] of [["p256dh", 65], ["auth", 16]]) {
      if (typeof value.keys?.[key] !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value.keys[key]) || Buffer.from(value.keys[key], "base64url").length !== length) return false;
    }
    ECDH.convertKey(Buffer.from(value.keys.p256dh, "base64url"), "prime256v1", undefined, undefined, "uncompressed");
    return true;
  } catch {
    return false;
  }
}

export async function sendPush(userIds, notification) {
  if (!pushConfigured() || userIds.length === 0) return true;
  try {
    const subscriptions = await PushSubscription.find({ user: { $in: userIds } });
    const { ttl = 3600, ...data } = notification;
    const id = data.id || randomUUID();
    const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify({ ...data, title: data.title.slice(0, 120), body: data.body.slice(0, 300), id, userId: subscription.user.toString() }),
          {
            TTL: ttl,
            timeout: 5000,
            vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
          }
        );
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          return;
        }
        throw error;
      }
    }));
    const failed = results.filter((result) => result.status === "rejected");
    for (const result of failed) console.error("Push delivery failed:", result.reason.statusCode || result.reason.code || result.reason.name);
    return failed.length === 0;
  } catch (error) {
    console.error("Push notification failed:", error.name);
    return false;
  }
}
