import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { deleteDevice } from "@/app/actions";
import {
  DEVICE_STATUS_LABELS,
  DEPLOYMENT_ACTION_LABELS,
  type DeviceStatus,
  type DeploymentAction,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeviceForm } from "@/components/DeviceForm";
import { DeploymentForm } from "@/components/DeploymentForm";
import { DocumentForm, DeleteDocButton } from "@/components/DocumentForm";
import { DeleteButton } from "@/components/DeleteButton";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const toDateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const editable = canEdit(user.role);

  const device = await prisma.device.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      purchase: true,
      deployments: { orderBy: { startDate: "desc" } },
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!device) notFound();

  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true }, take: 200 }),
  ]);

  const title = device.deviceName || device.modelNo || device.model || device.category;

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={[device.assetTag && `ID ${device.assetTag}`, device.serialImei && `SN/IMEI ${device.serialImei}`].filter(Boolean).join(" · ") || device.category}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={device.status} label={DEVICE_STATUS_LABELS[device.status as DeviceStatus] ?? device.status} />
            <Link href="/devices" className="btn-secondary">Back</Link>
            {editable && <DeleteButton action={deleteDevice.bind(null, device.id)} label="Delete" confirmText="Delete this device and its history?" />}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {editable ? (
            <DeviceForm
              device={{
                id: device.id,
                purchaseId: device.purchaseId,
                supplierId: device.supplierId,
                assetTag: device.assetTag,
                deviceName: device.deviceName,
                modelNo: device.modelNo,
                serialImei: device.serialImei,
                qtyPurchased: device.qtyPurchased,
                vendorName: device.vendorName,
                invoiceNo: device.invoiceNo,
                cost: device.costMinor ? device.costMinor / 100 : undefined,
                currency: device.currency,
                purchaseDate: toDateInput(device.purchaseDate),
                assignedTo: device.assignedTo,
                projectClient: device.projectClient,
                location: device.location,
                statusText: device.statusText,
                installedStatus: device.installedStatus,
                installedBy: device.installedBy,
                status: device.status,
                notes: device.notes,
              }}
              suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
              purchases={purchases.map((p) => ({ id: p.id, label: `${p.reference || format(p.purchaseDate, "d MMM yyyy")}${p.supplier ? ` · ${p.supplier.name}` : ""}` }))}
            />
          ) : (
            <div className="card p-6 text-sm text-muted">Read-only — ask an editor to make changes.</div>
          )}

          {/* Deployment history */}
          <div className="card p-5">
            <p className="text-sm font-medium text-fg">Deployment history</p>
            {device.deployments.length === 0 ? (
              <p className="mt-2 text-sm text-faint">No movements recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {device.deployments.map((d) => (
                  <li key={d.id} className="flex gap-3 border-l-2 border-border pl-3">
                    <div>
                      <p className="text-sm font-medium text-fg">
                        {DEPLOYMENT_ACTION_LABELS[d.action as DeploymentAction] ?? d.action}
                        {d.site ? ` — ${d.site}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        {format(d.startDate, "d MMM yyyy")}
                        {d.customer ? ` · ${d.customer}` : ""}
                        {d.assignedTo ? ` · ${d.assignedTo}` : ""}
                        {d.endDate ? ` · ended ${format(d.endDate, "d MMM yyyy")}` : ""}
                      </p>
                      {d.notes && <p className="text-xs text-faint">{d.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="mt-4">
                <DeploymentForm deviceId={device.id} />
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="card p-5">
          <p className="text-sm font-medium text-fg">Documents</p>
          <p className="mt-0.5 text-xs text-muted">Warranty card, config, photos…</p>
          {device.documents.length === 0 ? (
            <p className="mt-3 text-sm text-faint">None attached yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {device.documents.map((doc) => (
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
              <DocumentForm deviceId={device.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
