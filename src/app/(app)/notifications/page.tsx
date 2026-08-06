import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NotificationList } from "@/components/crm/NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const items = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.readAt != null,
    whenLabel: `${formatDistanceToNow(n.createdAt)} ago`,
  }));
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Notifications" subtitle={unread > 0 ? `${unread} unread` : "All caught up"} />
      <NotificationList items={items} unread={unread} />
    </div>
  );
}
