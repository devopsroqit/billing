import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { toggleAccountActive } from "@/app/crm-actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const q = (searchParams.q ?? "").trim();
  const type = searchParams.type ?? "";

  const accounts = await prisma.account.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { contacts: true, deals: true } } },
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const rows = q
    ? accounts.filter((a) =>
        [a.name, a.email, a.industry].filter(Boolean).some((v) => v!.toLowerCase().includes(q.toLowerCase())),
      )
    : accounts;

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Companies you sell to and partner with."
        action={editable ? <Link href="/crm/accounts/new" className="btn-primary">New account</Link> : null}
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Name, email, industry…" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="type" defaultValue={type}>
            <option value="">All types</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t as AccountType]}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {(q || type) && <Link href="/crm/accounts" className="btn-secondary">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No accounts found</p>
          <p className="mt-1 text-sm text-muted">{q || type ? "Try clearing the filters." : "Create your first account to get started."}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Name</th>
                <th className="th">Type</th>
                <th className="th">Owner</th>
                <th className="th text-right">Contacts</th>
                <th className="th text-right">Deals</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">
                    <Link href={`/crm/accounts/${a.id}`} className="hover:underline">{a.name}</Link>
                    {a.industry && <span className="block text-xs text-faint">{a.industry}</span>}
                  </td>
                  <td className="td"><StatusBadge status={a.type} label={ACCOUNT_TYPE_LABELS[a.type as AccountType] ?? a.type} /></td>
                  <td className="td text-muted">{a.ownerId ? userName.get(a.ownerId) ?? "—" : "—"}</td>
                  <td className="td text-right">{a._count.contacts}</td>
                  <td className="td text-right">{a._count.deals}</td>
                  <td className="td"><StatusBadge status={a.active ? "ACTIVE" : "INACTIVE"} label={a.active ? "Active" : "Inactive"} /></td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/crm/accounts/${a.id}`} className="text-xs font-medium text-muted hover:underline">Open</Link>
                      {editable && (
                        <form action={toggleAccountActive.bind(null, a.id)}>
                          <button className="text-xs font-medium text-brand-600 hover:underline">
                            {a.active ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      )}
                    </div>
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
