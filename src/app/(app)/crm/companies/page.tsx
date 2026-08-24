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
import { Pager } from "@/components/Pager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; category?: string; page?: string };
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  const q = (searchParams.q ?? "").trim();
  const type = searchParams.type ?? "";
  const category = (searchParams.category ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // Server-side filter — search + relationship type + category. Category is a
  // comma-separated string on the row, matched with a plain `contains`.
  const where: Record<string, unknown> = {};
  if (type) where.relationshipType = type;
  if (category) where.categories = { contains: category, mode: "insensitive" };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { domains: { contains: q, mode: "insensitive" } },
      { primaryLocation: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total, users, categoryRows] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { contacts: true, deals: true } } },
    }),
    prisma.company.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    // Category dropdown reads categories across ALL companies, not just the
    // current filter — so switching filters doesn't hide categories.
    prisma.company.findMany({ select: { categories: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const allCategories = Array.from(
    new Set(categoryRows.flatMap((c) => (c.categories ?? "").split(",").map((t) => t.trim()).filter(Boolean))),
  ).sort();

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="The organizations you sell to, partner with, and buy from."
        action={
          <div className="flex items-center gap-3">
            <a
              href={`/api/export/companies${new URLSearchParams({ ...(q && { q }), ...(type && { type }), ...(category && { category }) }).toString() ? `?${new URLSearchParams({ ...(q && { q }), ...(type && { type }), ...(category && { category }) }).toString()}` : ""}`}
              className="btn-secondary"
              title="Download the filtered company book as Excel"
            >
              ⬇ Export Excel
            </a>
            {editable && <Link href="/crm/companies/new" className="btn-primary">New company</Link>}
          </div>
        }
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
      <Pager total={total} page={page} pageSize={PAGE_SIZE} basePath="/crm/companies" params={{ q, type, category }} />
    </div>
  );
}
