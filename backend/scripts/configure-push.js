import "../src/lib/env.js";
import { pathToFileURL } from "node:url";
import { streamClient } from "../src/lib/stream.js";
import { STREAM_NOTIFICATION_EVENTS } from "../src/controllers/notification.controller.js";

export async function configurePushWebhook(webhookUrl) {
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/api/notifications/stream-webhook" || url.search || url.hash) {
    throw new Error("Use the deployed HTTPS URL ending in /api/notifications/stream-webhook");
  }
  const settings = await streamClient.getAppSettings();
  const hooks = settings.app.event_hooks || [];
  const existing = hooks.find((hook) => hook.hook_type === "webhook" && hook.webhook_url === url.href);
  const requiredEvents = Object.keys(STREAM_NOTIFICATION_EVENTS);
  const eventTypes = existing ? existing.event_types?.length ? [...new Set([...existing.event_types, ...requiredEvents])] : [] : requiredEvents;
  const hook = { ...existing, hook_type: "webhook", enabled: true, webhook_url: url.href, event_types: eventTypes };
  await streamClient.updateAppSettings({
    event_hooks: [...hooks.filter((item) => item.hook_type !== "webhook" || item.webhook_url !== url.href), hook],
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  configurePushWebhook(process.argv[2]).then(() => {
    console.log("Stream push webhook configured; existing hooks preserved.");
  }).catch((error) => {
    console.error("Unable to configure Stream push webhook:", error.message);
    process.exitCode = 1;
  });
}
