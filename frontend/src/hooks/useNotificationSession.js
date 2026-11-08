import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportPresence, subscribeBrowserPush, pushSupported } from "../lib/push.js";

export default function useNotificationSession(userId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    if (pushSupported() && Notification.permission === "granted" && localStorage.getItem("meetifyPushDisabled") !== "true") {
      subscribeBrowserPush(userId).catch(() => {});
    }
    const heartbeat = () => reportPresence(userId, navigator.onLine);
    const leave = () => reportPresence(userId, false, true);
    const receive = (event) => {
      if (event.data?.type === "MEETIFY_EVENT" && event.data.tag?.startsWith("friend-")) {
        for (const key of ["friendRequests", "friends", "users", "outgoingFriendReqs"]) queryClient.invalidateQueries({ queryKey: [key] });
      }
    };
    heartbeat();
    const timer = setInterval(heartbeat, 30000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("online", heartbeat);
    window.addEventListener("offline", heartbeat);
    window.addEventListener("pageshow", heartbeat);
    window.addEventListener("pagehide", leave);
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", receive);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("online", heartbeat);
      window.removeEventListener("offline", heartbeat);
      window.removeEventListener("pageshow", heartbeat);
      window.removeEventListener("pagehide", leave);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("message", receive);
    };
  }, [userId, queryClient]);
}
