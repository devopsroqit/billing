import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
import { AppChrome } from "@/components/ui/AppChrome";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const unreadNotifications = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <AppChrome>
      {/* First tab-stop on any page — lets keyboard users bypass the sidebar. */}
      <a href="#main-content" className="skip-to-content">Skip to main content</a>
      <div className="min-h-screen lg:flex">
        <Sidebar user={user} unreadNotifications={unreadNotifications} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </AppChrome>
  );
}
