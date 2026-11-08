import { randomUUID } from "node:crypto";

// shortcut: feeds share one server process; share feeds and receipts before adding multiple instances.
const feeds = new Map();
const pending = new Map();

export function openNotificationFeed(req, res) {
  const userId = req.user._id.toString();
  const connections = feeds.get(userId) || new Set();
  if (connections.size >= 10 || (!feeds.has(userId) && feeds.size >= 10000)) {
    return res.status(429).json({ message: "Too many notification connections. Close an unused tab." });
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  const connection = { res, token: req.cookies.jwt, close };
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(expiry);
    clearInterval(heartbeat);
    connections.delete(connection);
    if (!connections.size) feeds.delete(userId);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
  // Reconnect through authentication at least once a minute and never outlive the JWT.
  const remaining = req.auth?.exp ? req.auth.exp * 1000 - Date.now() : 60000;
  const expiry = setTimeout(close, Math.max(1, Math.min(60000, remaining)));
  expiry.unref();
  const heartbeat = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { close(); }
  }, 20000);
  heartbeat.unref();
  connections.add(connection);
  feeds.set(userId, connections);
  res.on("close", close);
  res.on("error", close);
  res.write("retry: 1000\n\n");
}

export function closeNotificationFeeds(userId, token) {
  for (const connection of feeds.get(userId.toString()) || []) {
    if (!token || connection.token === token) connection.close();
  }
}

export function acknowledgeNotification(userId, receipt, endpoint) {
  const delivery = pending.get(receipt);
  if (!delivery || delivery.userId !== userId.toString()) return;
  if (endpoint && delivery.allowedEndpoints.has(endpoint)) delivery.endpoints.add(endpoint);
}

export async function deliverInApp(userIds, notification, subscriptions) {
  const receipts = [];
  for (const userId of new Set(userIds.map(String))) {
    const connections = feeds.get(userId);
    if (!connections?.size) continue;
    const receipt = randomUUID();
    const delivery = { userId, endpoints: new Set(), allowedEndpoints: new Set(subscriptions.filter((subscription) => subscription.user.toString() === userId).map((subscription) => subscription.endpoint)) };
    pending.set(receipt, delivery);
    const event = `data: ${JSON.stringify({ ...notification, userId, receipt })}\n\n`;
    for (const connection of connections) {
      try { connection.res.write(event); } catch { connection.close(); }
    }
    receipts.push(new Promise((resolve) => {
      setTimeout(() => {
        pending.delete(receipt);
        resolve([...delivery.endpoints]);
      }, 1500);
    }));
  }
  return new Set((await Promise.all(receipts)).flat());
}
