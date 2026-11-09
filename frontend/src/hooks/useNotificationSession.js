import { createElement, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { reportPresence, subscribeBrowserPush, pushSupported } from "../lib/push.js";
import { connectNotifications } from "../lib/notifications.js";
import NotificationBanner from "../components/NotificationBanner.jsx";

export default function useNotificationSession(userId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const banners = new Set();
    const invalidateFriends = () => {
      for (const key of ["friendRequests", "friends", "userFriends", "users", "outgoingFriendReqs", "peopleSearch"]) queryClient.invalidateQueries({ queryKey: [key] });
    };
    const closeFeed = connectNotifications(userId, {
      onNotification: (notification) => {
        const id = `notification:${notification.url}`;
        banners.delete(id);
        banners.add(id);
        if (banners.size > 3) {
          const oldest = banners.values().next().value;
          toast.dismiss(oldest);
          banners.delete(oldest);
        }
        toast.custom((current) => createElement(NotificationBanner, {
          notification, visible: current.visible,
          onOpen: () => toast.dismiss(id),
          onDismiss: () => toast.dismiss(id),
        }), { id, position: "top-center", duration: 5000 });
      },
      onActivity: (notification) => { if (notification.tag?.startsWith("friend-")) invalidateFriends(); },
    });
    if (pushSupported() && Notification.permission === "granted" && localStorage.getItem("meetifyPushDisabled") !== "true") {
      subscribeBrowserPush(userId).catch(() => {});
    }
    const heartbeat = () => reportPresence(userId, navigator.onLine);
    const leave = () => reportPresence(userId, false, true);
    const receive = (event) => {
      if (event.data?.type === "MEETIFY_EVENT" && event.data.tag?.startsWith("friend-")) {
        invalidateFriends();
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
      closeFeed();
      banners.forEach((id) => toast.remove(id));
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
