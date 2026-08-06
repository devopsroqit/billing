import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { toggleUserActive, deleteUser } from "@/app/actions";
import { ROLE_LABELS, ROLE_HINTS, type Role } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await getSessionUser();
  if (!me || !canManageUsers(me.role)) redirect("/");

  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Give office members access with the right permissions."
        action={<Link href="/team/new" className="btn-primary">Add member</Link>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(["ADMIN", "EDITOR", "VIEWER"] as Role[]).map((r) => (
          <div key={r} className="card p-4">
            <p className="text-sm font-semibold text-fg">{ROLE_LABELS[r]}</p>
            <p className="mt-1 text-xs text-muted">{ROLE_HINTS[r]}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-2">
            <tr>
              <th className="th">Name</th>
              <th className="th">Email</th>
              <th className="th">Role</th>
              <th className="th">CRM access</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-2">
                <td className="td font-medium text-fg">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-faint">(you)</span>}</td>
                <td className="td">{u.email}</td>
                <td className="td">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                <td className="td">
                  {u.role === "ADMIN" ? (
                    <span className="text-xs text-muted">Full (admin)</span>
                  ) : u.canEditCrm ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Can edit</span>
                  ) : (
                    <span className="text-xs text-faint">View only</span>
                  )}
                </td>
                <td className="td"><StatusBadge status={u.active ? "ACTIVE" : "INACTIVE"} label={u.active ? "Active" : "Inactive"} /></td>
                <td className="td">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/team/${u.id}`} className="text-xs font-medium text-muted hover:underline">Edit</Link>
                    {u.id !== me.id && (
                      <>
                        <form action={toggleUserActive.bind(null, u.id)}>
                          <button className="text-xs font-medium text-brand-600 hover:underline">
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                        <DeleteButton
                          action={deleteUser.bind(null, u.id)}
                          label="Remove"
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          confirmText={`Remove ${u.name}? This permanently deletes the account and can't be undone. Their past records are kept.`}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
