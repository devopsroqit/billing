"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead, markAllNotificationsRead } from "@/app/crm-actions";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  whenLabel: string;
};

export function NotificationList({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [, start] = useTransition();

  const open = (n: NotificationItem) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.link) router.push(n.link);
    else router.refresh();
  };

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <button className="btn-secondary text-sm" onClick={() => start(() => void markAllNotificationsRead().then(() => router.refresh()))}>
            Mark all read
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">You’re all caught up</p>
          <p className="mt-1 text-sm text-muted">Notifications about your deals, tasks, and mentions will show here.</p>
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 ${n.read ? "" : "bg-brand-500/5"}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand-600"}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.read ? "text-muted" : "font-medium text-fg"}`}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-faint">{n.body}</span>}
                <span className="block text-xs text-faint">{n.whenLabel}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
