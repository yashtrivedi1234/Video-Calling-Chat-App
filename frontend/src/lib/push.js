import { axiosInstance } from "./axios.js";

let presenceDeviceId;

export const pushSupported = () => typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function getPresenceDeviceId() {
  if (!presenceDeviceId) {
    presenceDeviceId = crypto.randomUUID();
    sessionStorage.setItem("meetifyPresenceDevice", presenceDeviceId);
  }
  return presenceDeviceId;
}

export function pushEnabledFor(userId) {
  return pushSupported() && Notification.permission === "granted" && localStorage.getItem("meetifyPushUser") === userId && localStorage.getItem("meetifyPushDisabled") !== "true";
}

async function bindWorker(registration, message) {
  const worker = registration.active || registration.waiting;
  if (!worker) throw new Error("Notification service is starting. Please try again.");
  await new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const close = () => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); };
    const timer = setTimeout(() => { close(); reject(new Error("Notification setup timed out. Please try again.")); }, 5000);
    channel.port1.onmessage = () => { close(); resolve(); };
    try { worker.postMessage(message, [channel.port2]); } catch (error) { close(); reject(error); }
  });
}

export async function subscribeBrowserPush(userId) {
  if (!pushSupported() || Notification.permission !== "granted") throw new Error("Allow browser notifications to enable push.");
  const { data } = await axiosInstance.get("/notifications/config");
  if (!data.publicKey) throw new Error("Browser notifications are not configured on the server yet.");
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const padding = "=".repeat((4 - data.publicKey.length % 4) % 4);
  const key = Uint8Array.from(atob((data.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && subscription.options.applicationServerKey && new Uint8Array(subscription.options.applicationServerKey).toString() !== key.toString()) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try {
    await bindWorker(registration, { type: "UNBIND_USER" });
    const response = await axiosInstance.post("/notifications/subscriptions", subscription.toJSON());
    if (response.data.userId !== userId) throw new Error("Your account changed. Refresh the page before enabling notifications.");
    await bindWorker(registration, { type: "BIND_USER", userId });
  } catch (error) {
    await clearBrowserPush().catch(() => {});
    throw error;
  }
  localStorage.setItem("meetifyPushUser", userId);
  localStorage.setItem("meetifyPushEndpoint", subscription.endpoint);
  localStorage.removeItem("meetifyPushDisabled");
  window.dispatchEvent(new Event("meetify-push-change"));
}

export async function clearBrowserPush() {
  try {
    if (pushSupported()) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.active) await bindWorker(registration, { type: "UNBIND_USER" }).catch(() => {});
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
  } finally {
    localStorage.removeItem("meetifyPushUser");
    localStorage.removeItem("meetifyPushEndpoint");
    window.dispatchEvent(new Event("meetify-push-change"));
  }
}

export async function disableBrowserPush() {
  const endpoint = localStorage.getItem("meetifyPushEndpoint");
  try {
    if (endpoint) await axiosInstance.delete("/notifications/subscriptions", { data: { endpoint } });
  } finally {
    localStorage.setItem("meetifyPushDisabled", "true");
    await clearBrowserPush();
  }
}

export function reportPresence(userId, online, keepalive = false) {
  const body = { userId, deviceId: getPresenceDeviceId(), online };
  if (keepalive) {
    return fetch(`${axiosInstance.defaults.baseURL}/notifications/presence`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
  }
  return axiosInstance.post("/notifications/presence", body).catch(() => {});
}

export const reportTyping = (recipientId, type) => axiosInstance.post("/notifications/typing", { recipientId, type }).catch(() => {});

export function reportCall(callId, type, keepalive = false) {
  const body = { callId, type };
  if (keepalive) {
    return fetch(`${axiosInstance.defaults.baseURL}/notifications/call`, {
      method: "POST", credentials: "include", keepalive: true,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => {});
  }
  return axiosInstance.post("/notifications/call", body).catch(() => {});
}
