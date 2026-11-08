import { axiosInstance } from "./axios.js";

export function connectNotifications(userId, { onNotification, onActivity }) {
  if (!("EventSource" in window)) return () => {};
  const source = new window.EventSource(`${axiosInstance.defaults.baseURL}/notifications/events`, { withCredentials: true });
  const seen = new Set();
  let closed = false;
  const remember = (id) => {
    seen.add(id);
    if (seen.size > 100) seen.delete(seen.values().next().value);
  };
  const receivePush = (event) => {
    if (event.data?.type === "MEETIFY_EVENT" && event.data.userId === userId && typeof event.data.id === "string") remember(event.data.id);
  };
  source.onmessage = (event) => {
    if (closed) return;
    let notification;
    try { notification = JSON.parse(event.data); } catch { return; }
    if (!notification || notification.userId !== userId || typeof notification.id !== "string" || notification.id.length > 256 || typeof notification.receipt !== "string" || !/^[a-f0-9-]{36}$/i.test(notification.receipt) || typeof notification.title !== "string" || typeof notification.body !== "string" || typeof notification.url !== "string") return;
    let target;
    try { target = new URL(notification.url, window.location.origin); } catch { return; }
    if (target.origin !== window.location.origin) return;
    onActivity(notification);
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    const activeChat = target.pathname.startsWith("/chat/") && target.pathname === window.location.pathname;
    if (!seen.has(notification.id) && !activeChat) {
      onNotification({ ...notification, body: notification.type === "message.new" ? "Sent you a message." : notification.body, url: target.pathname + target.search + target.hash });
    }
    remember(notification.id);
    const endpoint = localStorage.getItem("meetifyPushUser") === userId ? localStorage.getItem("meetifyPushEndpoint") : null;
    void axiosInstance.post("/notifications/events/ack", { receipt: notification.receipt, endpoint }).catch(() => {});
  };
  navigator.serviceWorker?.addEventListener("message", receivePush);
  return () => {
    closed = true;
    source.close();
    seen.clear();
    navigator.serviceWorker?.removeEventListener("message", receivePush);
  };
}
