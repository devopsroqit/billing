import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const unreadNotifications = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar user={user} unreadNotifications={unreadNotifications} />
      <main className="min-w-0 flex-1">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
