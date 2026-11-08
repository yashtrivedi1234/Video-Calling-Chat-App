import { useEffect, useState } from "react";
import { BellPlusIcon, BellRingIcon } from "lucide-react";
import toast from "react-hot-toast";
import { disableBrowserPush, pushEnabledFor, pushSupported, subscribeBrowserPush } from "../lib/push.js";

export default function PushNotificationButton({ userId }) {
  const [enabled, setEnabled] = useState(() => pushEnabledFor(userId));
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(pushEnabledFor(userId));
    window.addEventListener("meetify-push-change", update);
    return () => window.removeEventListener("meetify-push-change", update);
  }, [userId]);

  const toggle = async () => {
    setPending(true);
    try {
      if (enabled) {
        await disableBrowserPush();
      } else {
        if (Notification.permission === "denied") throw new Error("Notifications are blocked. Allow them in your browser’s site settings.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notification permission was not granted.");
        await subscribeBrowserPush(userId);
      }
      toast.success(enabled ? "Browser notifications disabled" : "Browser notifications enabled");
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to update browser notifications.");
    } finally {
      setPending(false);
    }
  };

  const label = !pushSupported() ? "Browser push is unavailable on this browser" : enabled ? "Disable browser notifications" : "Enable browser notifications";
  return (
    <button type="button" className="btn btn-ghost btn-circle" onClick={toggle} disabled={pending || !userId || !pushSupported()} aria-label={label} title={label} aria-pressed={Boolean(enabled)}>
      {pending ? <span className="loading loading-spinner loading-sm" /> : enabled ? <BellRingIcon className="size-5 text-primary" aria-hidden="true" /> : <BellPlusIcon className="size-5" aria-hidden="true" />}
    </button>
  );
}
