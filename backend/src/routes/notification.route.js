import express from "express";
import { protectRoute } from "../middlewares/auth.middlewares.js";
import { getPushConfig, subscribePush, unsubscribePush, reportPresence, reportTyping, reportCall, acknowledgeNotificationFeed } from "../controllers/notification.controller.js";
import { openNotificationFeed } from "../lib/notificationFeed.js";

const router = express.Router();
router.use(protectRoute);
router.get("/config", getPushConfig);
router.post("/subscriptions", subscribePush);
router.delete("/subscriptions", unsubscribePush);
router.get("/events", openNotificationFeed);
router.post("/events/ack", acknowledgeNotificationFeed);
const activityLimits = new Map();
let lastCleanup = 0;
router.use((req, res, next) => {
  const now = Date.now();
  if (now - lastCleanup > 60000) {
    for (const [key, entry] of activityLimits) if (entry.until <= now) activityLimits.delete(key);
    lastCleanup = now;
  }
  const key = req.user._id.toString();
  const entry = activityLimits.get(key) || { count: 0, until: now + 60000 };
  if (entry.until <= now) { entry.count = 0; entry.until = now + 60000; }
  if (++entry.count > 180 || (!activityLimits.has(key) && activityLimits.size >= 10000)) return res.status(429).json({ message: "Too many activity updates. Please wait a moment." });
  // shortcut: limits apply per server process; use a shared limiter when running multiple instances.
  activityLimits.set(key, entry);
  next();
});
router.post("/presence", reportPresence);
router.post("/typing", reportTyping);
router.post("/call", reportCall);

export default router;
