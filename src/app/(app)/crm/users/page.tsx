import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// The "Users" tab is the internal book of business: each team member and the
// companies assigned to them (they are that company's account owner), plus how
// many open tasks they're carrying.
export default async function CrmUsersPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  // Companies owned per user, and open tasks assigned per user — one pass each.
  const [companyCounts, contactCounts, openTaskCounts] = await Promise.all([
    prisma.company.groupBy({ by: ["ownerId"], where: { active: true }, _count: true }),
    prisma.contact.groupBy({ by: ["ownerId"], _count: true }),
    prisma.task.groupBy({ by: ["assigneeUserId"], where: { status: { notIn: ["DONE", "CANCELLED"] } }, _count: true }),
  ]);
  const companiesBy = new Map(companyCounts.map((r) => [r.ownerId, r._count]));
  const contactsBy = new Map(contactCounts.map((r) => [r.ownerId, r._count]));
  const tasksBy = new Map(openTaskCounts.map((r) => [r.assigneeUserId, r._count]));

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Internal team members and the companies assigned to them."
      />

      {users.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No active team members</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Member</th>
                <th className="th">Role</th>
                <th className="th text-right">Companies</th>
                <th className="th text-right">Contacts</th>
                <th className="th text-right">Open tasks</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">
                    <Link href={`/crm/users/${u.id}`} className="hover:underline">{u.name}</Link>
                    <span className="block text-xs text-faint">{u.email}</span>
                  </td>
                  <td className="td"><StatusBadge status={u.role === "ADMIN" ? "ACTIVE" : "OPEN"} label={ROLE_LABELS[u.role as Role] ?? u.role} /></td>
                  <td className="td text-right">{companiesBy.get(u.id) ?? 0}</td>
                  <td className="td text-right">{contactsBy.get(u.id) ?? 0}</td>
                  <td className="td text-right">{tasksBy.get(u.id) ?? 0}</td>
                  <td className="td text-right">
                    <Link href={`/crm/users/${u.id}`} className="text-xs font-medium text-muted hover:underline">View book</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
