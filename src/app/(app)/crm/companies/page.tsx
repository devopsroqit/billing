import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { toggleCompanyActive } from "@/app/crm-actions";
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  type RelationshipType,
} from "@/lib/constants";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; category?: string };
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  const q = (searchParams.q ?? "").trim();
  const type = searchParams.type ?? "";
  const category = (searchParams.category ?? "").trim();

  const companies = await prisma.company.findMany({
    where: type ? { relationshipType: type } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { contacts: true, deals: true } } },
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  // The set of categories across all companies, for the filter dropdown.
  const allCategories = Array.from(
    new Set(companies.flatMap((c) => (c.categories ?? "").split(",").map((t) => t.trim()).filter(Boolean))),
  ).sort();

  let rows = companies;
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((c) =>
      [c.name, c.email, c.domains, c.primaryLocation, c.categories]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }
  if (category) {
    rows = rows.filter((c) =>
      (c.categories ?? "").split(",").map((t) => t.trim().toLowerCase()).includes(category.toLowerCase()),
    );
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="The organizations you sell to, partner with, and buy from."
        action={editable ? <Link href="/crm/companies/new" className="btn-primary">New company</Link> : null}
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Name, domain, location…" />
        </div>
        <div>
          <label className="label">Relationship</label>
          <select className="input" name="type" defaultValue={type}>
            <option value="">All types</option>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t as RelationshipType]}</option>
            ))}
          </select>
        </div>
        {allCategories.length > 0 && (
          <div>
            <label className="label">Category</label>
            <select className="input" name="category" defaultValue={category}>
              <option value="">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <button className="btn-primary" type="submit">Filter</button>
        {(q || type || category) && <Link href="/crm/companies" className="btn-secondary">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No companies found"
          hint={q || type || category ? "Try clearing the filters." : "Add the organizations you sell to, partner with, and buy from — one place for the whole team."}
          action={
            (q || type || category)
              ? <Link href="/crm/companies" className="btn-secondary">Clear filters</Link>
              : editable ? <Link href="/crm/companies/new" className="btn-primary">Create your first company</Link> : null
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Name</th>
                <th className="th">Relationship</th>
                <th className="th">Owner</th>
                <th className="th text-right">Contacts</th>
                <th className="th text-right">Deals</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">
                    <Link href={`/crm/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                    {c.primaryLocation && <span className="block text-xs text-faint">{c.primaryLocation}</span>}
                  </td>
                  <td className="td"><StatusBadge status={c.relationshipType} label={RELATIONSHIP_TYPE_LABELS[c.relationshipType as RelationshipType] ?? c.relationshipType} /></td>
                  <td className="td text-muted">{c.ownerId ? userName.get(c.ownerId) ?? "—" : "—"}</td>
                  <td className="td text-right">{c._count.contacts}</td>
                  <td className="td text-right">{c._count.deals}</td>
                  <td className="td"><StatusBadge status={c.active ? "ACTIVE" : "INACTIVE"} label={c.active ? "Active" : "Inactive"} /></td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/crm/companies/${c.id}`} className="text-xs font-medium text-muted hover:underline">Open</Link>
                      {editable && (
                        <form action={toggleCompanyActive.bind(null, c.id)}>
                          <button className="text-xs font-medium text-brand-600 hover:underline">
                            {c.active ? "Deactivate" : "Activate"}
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
