import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: { q?: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  const q = (searchParams.q ?? "").trim();

  const contacts = await prisma.contact.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { company: { select: { id: true, name: true } } },
  });

  const rows = q
    ? contacts.filter((c) =>
        [`${c.firstName} ${c.lastName}`, c.email, c.phone, c.company?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q.toLowerCase())),
      )
    : contacts;

  // Clicking a contact takes you to the company it's associated with; a contact
  // with no company falls back to its own record.
  const target = (c: (typeof rows)[number]) =>
    c.company ? `/crm/companies/${c.company.id}` : `/crm/contacts/${c.id}`;

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="People at your companies. Opening a contact jumps to their company."
        action={editable ? <Link href="/crm/contacts/new" className="btn-primary">New contact</Link> : null}
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Name, email, company…" />
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {q && <Link href="/crm/contacts" className="btn-secondary">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No contacts found"
          hint={q ? "Try a different search." : "Add people at your companies so you can reach the right person from any deal."}
          action={
            q
              ? <Link href="/crm/contacts" className="btn-secondary">Clear search</Link>
              : editable ? <Link href="/crm/contacts/new" className="btn-primary">Add your first contact</Link> : null
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Name</th>
                <th className="th">Company</th>
                <th className="th">Title</th>
                <th className="th">Contact</th>
                <th className="th text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">
                    <Link href={target(c)} className="hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    {c.isPrimary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                  </td>
                  <td className="td text-muted">
                    {c.company ? <Link href={`/crm/companies/${c.company.id}`} className="hover:underline">{c.company.name}</Link> : "—"}
                  </td>
                  <td className="td text-muted">{c.title ?? "—"}</td>
                  <td className="td text-muted">
                    {c.email ?? "—"}
                    {c.phone && <span className="block text-xs text-faint">{c.phone}</span>}
                  </td>
                  <td className="td text-right">
                    <Link href={`/crm/contacts/${c.id}`} className="text-xs font-medium text-muted hover:underline">Open contact</Link>
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
