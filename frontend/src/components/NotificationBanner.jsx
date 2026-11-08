import { BellIcon, MessageCircleIcon, VideoIcon, XIcon } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotificationBanner({ notification, visible, onOpen, onDismiss }) {
  const Icon = notification.type === "call.invite" ? VideoIcon : notification.url.startsWith("/chat/") ? MessageCircleIcon : BellIcon;
  return (
    <div role="status" className={`pointer-events-auto flex w-96 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-base-content/10 bg-base-100 p-2 text-base-content shadow-xl transition duration-200 motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>
      <Link to={notification.url} onClick={onOpen} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Open notification: ${notification.title}. ${notification.body}`}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-50"><span>Meetify</span><span>Now</span></span>
          <span className="block truncate text-sm font-bold">{notification.title}</span>
          <span className="block line-clamp-2 text-xs opacity-70">{notification.body}</span>
        </span>
      </Link>
      <button type="button" className="btn btn-ghost btn-circle size-11 shrink-0" onClick={onDismiss} aria-label="Dismiss notification">
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
