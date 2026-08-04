import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { toggleSupplierActive, deleteSupplier } from "@/app/actions";
import { SUPPLIER_TYPE_LABELS, type SupplierType } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { devices: true, purchases: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Suppliers & OEMs"
        subtitle="The parties you procure IoT devices from."
        action={editable ? <Link href="/suppliers/new" className="btn-primary">New supplier</Link> : null}
      />

      {suppliers.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No suppliers yet.</p>
          {editable && <p className="mt-1 text-sm text-muted">Add the OEMs/parties you buy devices from.</p>}
        </div>
      ) : (
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
      )}
    </div>
  );
}
