import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  type Role,
  type RelationshipType,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

// A single team member's book of business: the companies they own and the open
// tasks assigned to them. Read-only — reassignment happens on the company record
// (its "Account owner" field), keeping a single source of truth.
export default async function CrmUserDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user) notFound();

  const [companies, contactCount, tasks] = await Promise.all([
    prisma.company.findMany({
      where: { ownerId: user.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { contacts: true, deals: true } } },
    }),
    prisma.contact.count({ where: { ownerId: user.id } }),
    prisma.activity.findMany({
      where: { ownerId: user.id, type: "TASK", status: "OPEN" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { company: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted">
        <Link href="/crm/users" className="hover:underline">Users</Link>
        <span>/</span>
        <span className="text-fg">{user.name}</span>
      </div>

      <PageHeader
        title={user.name}
        subtitle={user.email}
        action={<StatusBadge status={user.role === "ADMIN" ? "ACTIVE" : "OPEN"} label={ROLE_LABELS[user.role as Role] ?? user.role} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Companies" value={companies.length} />
        <Stat label="Contacts" value={contactCount} />
        <Stat label="Open tasks" value={tasks.length} />
        <Stat label="Status" value={user.active ? "Active" : "Inactive"} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-fg">Assigned companies</h2>
        {companies.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No companies assigned. Set this member as the account owner on a company to assign it.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-2">
                <tr>
                  <th className="th">Company</th>
                  <th className="th">Relationship</th>
                  <th className="th text-right">Contacts</th>
                  <th className="th text-right">Deals</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2">
                    <td className="td font-medium text-fg">
                      <Link href={`/crm/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                    </td>
                    <td className="td"><StatusBadge status={c.relationshipType} label={RELATIONSHIP_TYPE_LABELS[c.relationshipType as RelationshipType] ?? c.relationshipType} /></td>
                    <td className="td text-right">{c._count.contacts}</td>
                    <td className="td text-right">{c._count.deals}</td>
                    <td className="td"><StatusBadge status={c.active ? "ACTIVE" : "INACTIVE"} label={c.active ? "Active" : "Inactive"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Open tasks</h2>
        {tasks.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No open tasks.</p>
        ) : (
          <div className="card divide-y divide-border">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-fg">
                  {t.subject}
                  {t.company && (
                    <Link href={`/crm/companies/${t.company.id}`} className="block text-xs text-brand-600 hover:underline">{t.company.name}</Link>
                  )}
                </span>
                <span className="text-xs text-faint">{t.dueDate ? `Due ${format(t.dueDate, "d MMM yyyy")}` : "No due date"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 text-lg font-semibold text-fg">{value}</p>
    </div>
  );
}
