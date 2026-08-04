import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { deletePurchase } from "@/app/actions";
import { formatMoneyCompact } from "@/lib/money";
import { DEVICE_STATUS_LABELS, type DeviceStatus, type Currency } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { PurchaseForm } from "@/components/PurchaseForm";
import { DocumentForm, DeleteDocButton } from "@/components/DocumentForm";
import { DeleteButton } from "@/components/DeleteButton";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const editable = canEdit(user.role);

  const purchase = await prisma.purchase.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      devices: { orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!purchase) notFound();

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title={purchase.reference || `Purchase ${format(purchase.purchaseDate, "d MMM yyyy")}`}
        subtitle={`${purchase.supplier?.name ?? "No supplier"} · ${formatMoneyCompact(purchase.amountMinor, purchase.currency as Currency)} · qty ${purchase.quantity}`}
        action={
          <div className="flex gap-2">
            <Link href="/purchases" className="btn-secondary">Back</Link>
            {editable && <DeleteButton action={deletePurchase.bind(null, purchase.id)} label="Delete purchase" confirmText="Delete this purchase? Devices linked to it are kept." />}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {editable ? (
            <PurchaseForm purchase={purchase} suppliers={suppliers} />
          ) : (
            <div className="card p-6 text-sm text-muted">Read-only — ask an editor to make changes.</div>
          )}

          {/* Devices from this purchase */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="text-sm font-medium text-fg">Devices from this purchase ({purchase.devices.length})</p>
              {editable && (
                <Link href={`/devices/new?purchaseId=${purchase.id}${purchase.supplierId ? `&supplierId=${purchase.supplierId}` : ""}`} className="btn-primary text-xs">
                  Add device
                </Link>
              )}
            </div>
            {purchase.devices.length === 0 ? (
              <p className="p-4 text-sm text-faint">No devices recorded against this purchase yet.</p>
            ) : (
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="th">Category / Model</th>
                    <th className="th">Serial</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchase.devices.map((d) => (
                    <tr key={d.id} className="hover:bg-surface-2">
                      <td className="td">
                        <Link href={`/devices/${d.id}`} className="font-medium text-brand-600 hover:underline">
                          {d.category}{d.model ? ` · ${d.model}` : ""}
                        </Link>
                      </td>
                      <td className="td">{d.serialNo || "—"}</td>
                      <td className="td"><StatusBadge status={d.status} label={DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="card p-5">
          <p className="text-sm font-medium text-fg">Documents</p>
          <p className="mt-0.5 text-xs text-muted">Invoice, delivery note, warranty card…</p>
          {purchase.documents.length === 0 ? (
            <p className="mt-3 text-sm text-faint">None attached yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {purchase.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                  <div className="min-w-0">
                    {doc.kind === "LINK" ? (
                      <a href={doc.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-600 hover:underline">🔗 {doc.title}</a>
                    ) : (
                      <a href={`/api/documents/${doc.id}`} className="truncate text-sm text-brand-600 hover:underline">📄 {doc.title}</a>
                    )}
                    <p className="text-[11px] text-faint">{doc.uploadedBy?.name ?? "—"} · {format(doc.createdAt, "d MMM yyyy")}</p>
                  </div>
                  {editable && <DeleteDocButton id={doc.id} />}
                </li>
              ))}
            </ul>
          )}
          {editable && (
            <div className="mt-4">
              <DocumentForm purchaseId={purchase.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
