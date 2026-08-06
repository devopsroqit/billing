import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoneyCompact } from "@/lib/money";
import { SUPPLIER_TYPE_LABELS, type SupplierType, type Currency } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { toggleSupplierActive, deleteSupplier } from "@/app/actions";

export const dynamic = "force-dynamic";

type Tab = "suppliers" | "purchases";

// Procurement combines the former Suppliers and Purchases screens into one page
// with two sub-tabs. The record/new routes still live under /suppliers/* and
// /purchases/*; those bare list routes now redirect here.
export default async function ProcurementPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const editable = canEdit(user.role);
  const tab: Tab = searchParams.tab === "purchases" ? "purchases" : "suppliers";

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="The suppliers you buy from, and the purchase records for what you bought."
        action={
          editable ? (
            tab === "suppliers" ? (
              <Link href="/suppliers/new" className="btn-primary">New supplier</Link>
            ) : (
              <Link href="/purchases/new" className="btn-primary">New purchase</Link>
            )
          ) : null
        }
      />

      <div className="mb-4 flex items-center gap-2 border-b border-border">
        <TabLink tab="suppliers" active={tab} label="Suppliers" />
        <TabLink tab="purchases" active={tab} label="Purchases" />
      </div>

      {tab === "suppliers" ? <SuppliersTab editable={editable} /> : <PurchasesTab editable={editable} />}
    </div>
  );
}

function TabLink({ tab, active, label }: { tab: Tab; active: Tab; label: string }) {
  return (
    <Link
      href={`/procurement?tab=${tab}`}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active === tab ? "border-brand-600 text-brand-600" : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );
}

async function SuppliersTab({ editable }: { editable: boolean }) {
  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { devices: true, purchases: true } } },
  });

  if (suppliers.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm font-medium text-fg">No suppliers yet.</p>
        {editable && <p className="mt-1 text-sm text-muted">Add the OEMs/parties you buy devices from.</p>}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-surface-2">
          <tr>
            <th className="th">Supplier</th>
            <th className="th">Type</th>
            <th className="th">Contact</th>
            <th className="th text-right">Purchases</th>
            <th className="th text-right">Devices</th>
            <th className="th">Status</th>
            {editable && <th className="th text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {suppliers.map((s) => (
            <tr key={s.id} className="hover:bg-surface-2">
              <td className="td font-medium text-fg">
                {s.name}
                {s.website && <p className="text-xs font-normal text-faint">{s.website}</p>}
              </td>
              <td className="td">{SUPPLIER_TYPE_LABELS[s.type as SupplierType] ?? s.type}</td>
              <td className="td">
                {s.contactName || "—"}
                {s.contactEmail && <p className="text-xs text-faint">{s.contactEmail}</p>}
              </td>
              <td className="td text-right">{s._count.purchases}</td>
              <td className="td text-right">{s._count.devices}</td>
              <td className="td"><StatusBadge status={s.active ? "ACTIVE" : "INACTIVE"} label={s.active ? "Active" : "Inactive"} /></td>
              {editable && (
                <td className="td">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/suppliers/${s.id}`} className="text-xs font-medium text-muted hover:underline">Edit</Link>
                    <form action={toggleSupplierActive.bind(null, s.id)}>
                      <button className="text-xs font-medium text-brand-600 hover:underline">{s.active ? "Deactivate" : "Activate"}</button>
                    </form>
                    <DeleteButton
                      action={deleteSupplier.bind(null, s.id)}
                      label="Delete"
                      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      confirmText={`Delete supplier “${s.name}”? Its ${s._count.purchases} purchase(s) and ${s._count.devices} device(s) are kept but will no longer show this supplier.`}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function PurchasesTab({ editable }: { editable: boolean }) {
  const purchases = await prisma.purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { supplier: true, _count: { select: { devices: true, documents: true } } },
    take: 500,
  });

  if (purchases.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm font-medium text-fg">No purchases yet.</p>
        {editable && <p className="mt-1 text-sm text-muted">Record your first device procurement.</p>}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-surface-2">
          <tr>
            <th className="th">Date</th>
            <th className="th">Reference</th>
            <th className="th">Supplier</th>
            <th className="th text-right">Qty</th>
            <th className="th text-right">Amount</th>
            <th className="th text-right">Devices</th>
            <th className="th text-right">Docs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {purchases.map((p) => (
            <tr key={p.id} className="hover:bg-surface-2">
              <td className="td whitespace-nowrap">
                <Link href={`/purchases/${p.id}`} className="font-medium text-brand-600 hover:underline">
                  {format(p.purchaseDate, "d MMM yyyy")}
                </Link>
              </td>
              <td className="td">{p.reference || "—"}</td>
              <td className="td">{p.supplier?.name || "—"}</td>
              <td className="td text-right">{p.quantity}</td>
              <td className="td text-right">{formatMoneyCompact(p.amountMinor, p.currency as Currency)}</td>
              <td className="td text-right">{p._count.devices}</td>
              <td className="td text-right">{p._count.documents}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
