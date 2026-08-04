import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const q = (searchParams.q ?? "").trim();

  const contacts = await prisma.contact.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { account: { select: { id: true, name: true } } },
  });

  const rows = q
    ? contacts.filter((c) =>
        [`${c.firstName} ${c.lastName}`, c.email, c.phone, c.account?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q.toLowerCase())),
      )
    : contacts;

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="People at your accounts."
        action={editable ? <Link href="/crm/contacts/new" className="btn-primary">New contact</Link> : null}
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Name, email, account…" />
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {q && <Link href="/crm/contacts" className="btn-secondary">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No contacts found</p>
          <p className="mt-1 text-sm text-muted">{q ? "Try a different search." : "Add your first contact."}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Name</th>
                <th className="th">Account</th>
                <th className="th">Title</th>
                <th className="th">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">
                    <Link href={`/crm/contacts/${c.id}`} className="hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    {c.isPrimary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                  </td>
                  <td className="td text-muted">
                    {c.account ? <Link href={`/crm/accounts/${c.account.id}`} className="hover:underline">{c.account.name}</Link> : "—"}
                  </td>
                  <td className="td text-muted">{c.title ?? "—"}</td>
                  <td className="td text-muted">
                    {c.email ?? "—"}
                    {c.phone && <span className="block text-xs text-faint">{c.phone}</span>}
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
