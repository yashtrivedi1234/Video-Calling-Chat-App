import { createHash } from "node:crypto";
import mongoose from "mongoose";
import PushSubscription from "../models/PushSubscription.js";
import Presence from "../models/Presence.js";
import User from "../models/User.js";
import { pushConfigured, sendPush, validPushSubscription } from "../lib/push.js";
import { leavePresence, syncPresence } from "../lib/presence.js";
import { streamClient } from "../lib/stream.js";

export const STREAM_NOTIFICATION_EVENTS = {
  "message.new": "sent you a message",
  "message.read": "read your messages",
  "message.updated": "updated a message",
  "message.deleted": "deleted a message",
  "reaction.new": "reacted to a message",
  "reaction.updated": "updated a reaction",
  "reaction.deleted": "removed a reaction",
  "channel.created": "started a conversation",
  "channel.updated": "updated the conversation",
  "channel.deleted": "deleted the conversation",
  "channel.truncated": "cleared the conversation",
  "channel.muted": "muted the conversation",
  "channel.unmuted": "unmuted the conversation",
  "member.added": "added a conversation member",
  "member.removed": "removed a conversation member",
};

export function getPushConfig(req, res) {
  res.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}

export async function subscribePush(req, res) {
  if (!pushConfigured()) return res.status(503).json({ message: "Push notifications are not configured yet." });
  if (!validPushSubscription(req.body)) return res.status(400).json({ message: "Invalid browser push subscription." });
  try {
    const existing = await PushSubscription.exists({ user: req.user._id, endpoint: req.body.endpoint });
    if (!existing && await PushSubscription.countDocuments({ user: req.user._id }) >= 10) {
      return res.status(400).json({ message: "Disable notifications on an old device before adding another." });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint: req.body.endpoint },
      { $set: { user: req.user._id, keys: { p256dh: req.body.keys.p256dh, auth: req.body.keys.auth } } },
      { upsert: true, runValidators: true }
    );
    res.status(201).json({ success: true, userId: req.user._id.toString() });
  } catch (error) {
    console.error("Push subscription failed:", error.name);
    res.status(500).json({ message: "Unable to save notification settings." });
  }
}

export async function unsubscribePush(req, res) {
  if (typeof req.body?.endpoint !== "string") return res.status(400).json({ message: "Browser subscription is required." });
  try {
    await PushSubscription.deleteOne({ user: req.user._id, endpoint: req.body.endpoint });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Unable to update notification settings." });
  }
}

export async function reportPresence(req, res) {
  const { deviceId, online, userId } = req.body || {};
  if (typeof deviceId !== "string" || !/^[a-f0-9-]{36}$/i.test(deviceId) || typeof online !== "boolean" || userId !== req.user._id.toString()) {
    return res.status(400).json({ message: "Invalid presence update." });
  }
  try {
    if (online) {
      await Presence.findOneAndUpdate({ user: req.user._id, deviceId }, { $set: { lastSeenAt: new Date() } }, { upsert: true });
      await syncPresence(req.user._id);
    } else {
      await leavePresence(req.user._id, deviceId);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Unable to update presence." });
  }
}

export async function reportTyping(req, res) {
  const { recipientId, type } = req.body || {};
  if (!["typing.start", "typing.stop"].includes(type) || !mongoose.isValidObjectId(recipientId)) {
    return res.status(400).json({ message: "Invalid typing event." });
  }
  if (!req.user.friends.some((id) => id.toString() === recipientId)) return res.status(403).json({ message: "You can only notify your friends." });
  await sendPush([recipientId], {
    title: "Typing activity",
    body: `${req.user.fullName} ${type === "typing.start" ? "is typing…" : "stopped typing."}`,
    url: `/chat/${req.user._id}`,
    tag: `typing:${req.user._id}`,
    ttl: 15,
  });
  res.json({ success: true });
}

export async function reportCall(req, res) {
  const { callId, type } = req.body || {};
  if (!["call.joined", "call.left"].includes(type) || typeof callId !== "string" || !/^[a-f0-9]{24}-[a-f0-9]{24}$/i.test(callId)) {
    return res.status(400).json({ message: "Invalid call event." });
  }
  const participants = callId.split("-");
  const ownId = req.user._id.toString();
  const recipientId = participants.find((id) => id !== ownId);
  if (!participants.includes(ownId) || !recipientId || !req.user.friends.some((id) => id.toString() === recipientId)) {
    return res.status(403).json({ message: "You can only notify a call participant who is your friend." });
  }
  await sendPush([recipientId], {
    title: "Video call activity",
    body: `${req.user.fullName} ${type === "call.joined" ? "joined" : "left"} your video call.`,
    url: type === "call.joined" ? `/call/${callId}` : `/chat/${ownId}`,
    tag: `call:${callId}`,
    ttl: 60,
  });
  res.json({ success: true });
}

export async function streamWebhook(req, res) {
  if (!Buffer.isBuffer(req.body) || !streamClient.verifyWebhook(req.body, req.get("x-signature") || "")) {
    return res.status(401).json({ message: "Invalid webhook signature." });
  }
  try {
    const event = JSON.parse(req.body.toString("utf8"));
    if (!Object.hasOwn(STREAM_NOTIFICATION_EVENTS, event.type) || event.message?.silent) return res.json({ success: true });
    const actorId = event.user?.id || event.message?.user?.id;
    if (!mongoose.isValidObjectId(actorId)) return res.json({ success: true });
    const actor = await User.findById(actorId).select("fullName friends");
    if (!actor) return res.json({ success: true });
    const channelId = event.channel_id || event.channel?.id || event.cid?.split(":").slice(1).join(":");
    if (typeof channelId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(channelId)) return res.status(400).json({ message: "Invalid channel." });
    let members = event.members || event.channel?.members;
    if (!Array.isArray(members)) {
      const channel = await streamClient.channel("messaging", channelId).query({ state: true, watch: false, messages: { limit: 0 } });
      members = channel.members;
    }
    const recipients = members.filter((member) => !member.notifications_muted).map((member) => member.user_id || member.user?.id).filter((id) => id !== actorId && actor.friends.some((friend) => friend.toString() === id));
    const callInvite = event.type === "message.new" && event.message?.meetify_event === "call.invite" && event.message?.call_id === channelId;
    const messageText = typeof event.message?.text === "string" ? event.message.text.slice(0, 160) : "";
    const delivered = await sendPush(recipients, {
      id: createHash("sha256").update(req.body).digest("hex"),
      title: callInvite ? "Video call invitation" : event.type === "message.new" ? `Message from ${actor.fullName}` : "Conversation activity",
      body: callInvite ? `${actor.fullName} invited you to a video call.` : event.type === "message.new" ? messageText || `${actor.fullName} sent an attachment.` : `${actor.fullName} ${STREAM_NOTIFICATION_EVENTS[event.type]}.`,
      url: callInvite ? `/call/${channelId}` : `/chat/${actorId}`,
      tag: callInvite ? `call:${channelId}` : `chat:${channelId}:${event.type}`,
      ttl: callInvite ? 60 : 3600,
    });
    res.status(delivered ? 200 : 503).json({ success: delivered });
  } catch (error) {
    console.error("Stream notification webhook failed:", error.name);
    res.status(500).json({ message: "Unable to process event." });
  }
}
