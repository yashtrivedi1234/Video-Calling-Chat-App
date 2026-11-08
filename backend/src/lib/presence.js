import Presence from "../models/Presence.js";
import User from "../models/User.js";
import { sendPush } from "./push.js";

export const PRESENCE_LEASE_MS = 90000;

export async function syncPresence(userId) {
  const online = Boolean(await Presence.exists({ user: userId, lastSeenAt: { $gt: new Date(Date.now() - PRESENCE_LEASE_MS) } }));
  const user = await User.findOneAndUpdate(
    { _id: userId, presenceOnline: { $ne: online } },
    { $set: { presenceOnline: online } },
    { new: true }
  ).select("fullName friends");
  if (user) await sendPush(user.friends, {
    title: "Friend status",
    body: `${user.fullName} is now ${online ? "online" : "offline"}.`,
    url: `/chat/${user._id}`,
    tag: `presence:${user._id}`,
    ttl: 60,
  });
}

export async function expirePresence() {
  const cutoff = new Date(Date.now() - PRESENCE_LEASE_MS);
  const expired = await Presence.find({ lastSeenAt: { $lte: cutoff } }).select("user");
  await Presence.deleteMany({ lastSeenAt: { $lte: cutoff } });
  await Promise.all([...new Set(expired.map((entry) => entry.user.toString()))].map(syncPresence));
}

export async function leavePresence(userId, deviceId) {
  await Presence.deleteOne({ user: userId, deviceId });
  await syncPresence(userId);
}
