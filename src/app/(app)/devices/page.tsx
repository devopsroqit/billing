import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoneyCompact } from "@/lib/money";
import {
  DEVICE_STATUSES,
  DEVICE_STATUS_LABELS,
  type DeviceStatus,
  type Currency,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeviceBulkUpload } from "@/components/DeviceBulkUpload";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { status?: string; supplierId?: string; q?: string };
}) {
  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const status = searchParams.status?.trim() || "";
  const supplierId = searchParams.supplierId?.trim() || "";
  const q = searchParams.q?.trim() || "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (q) {
    where.OR = [
      { assetTag: { contains: q, mode: "insensitive" } },
      { deviceName: { contains: q, mode: "insensitive" } },
      { modelNo: { contains: q, mode: "insensitive" } },
      { serialImei: { contains: q, mode: "insensitive" } },
      { vendorName: { contains: q, mode: "insensitive" } },
      { invoiceNo: { contains: q, mode: "insensitive" } },
      { assignedTo: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      // legacy fields, for devices created before the template columns
      { imei: { contains: q, mode: "insensitive" } },
      { serialNo: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
    ];
  }

  const [devices, suppliers, total] = await Promise.all([
    prisma.device.findMany({ where, orderBy: { createdAt: "desc" }, include: { supplier: true }, take: 1000 }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.device.count(),
  ]);

  const queryStr = new URLSearchParams({ ...(status && { status }), ...(supplierId && { supplierId }), ...(q && { q }) }).toString();

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle={`${total} device${total === 1 ? "" : "s"} in the inventory`}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/export/devices${queryStr ? `?${queryStr}` : ""}`} className="btn-secondary">⬇ Export Excel</a>
            {editable && <Link href="/devices/new" className="btn-primary">Add device</Link>}
          </div>
        }
      />

      {editable && <DeviceBulkUpload />}

      {/* Filters */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Device ID, name, serial/IMEI, vendor…" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {DEVICE_STATUSES.map((s) => <option key={s} value={s}>{DEVICE_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Supplier</label>
          <select className="input" name="supplierId" defaultValue={supplierId}>
            <option value="">All suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {(status || supplierId || q) && <Link href="/devices" className="btn-secondary">Clear</Link>}
      </form>

      {devices.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No devices found.</p>
          {editable && <p className="mt-1 text-sm text-muted">Add devices directly, or from a purchase.</p>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">S.No</th>
                <th className="th">Date</th>
                <th className="th">Device ID</th>
                <th className="th">Device Name</th>
                <th className="th">Model No</th>
                <th className="th">Serial No / IMEI</th>
                <th className="th text-right">Qty</th>
                <th className="th">Vendor Name</th>
                <th className="th">Invoice No</th>
                <th className="th text-right">Purchase Cost</th>
                <th className="th">Assigned To</th>
                <th className="th">Project / Client</th>
                <th className="th">Location</th>
                <th className="th">Status</th>
                <th className="th">Installed</th>
                <th className="th">Installed by</th>
                <th className="th">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.map((d, i) => (
                <tr key={d.id} className="hover:bg-surface-2">
                  <td className="td text-faint">{i + 1}</td>
                  <td className="td whitespace-nowrap">{d.purchaseDate ? format(d.purchaseDate, "d-MMM-yy") : "—"}</td>
                  <td className="td">
                    <Link href={`/devices/${d.id}`} className="font-medium text-brand-600 hover:underline">
                      {d.assetTag || "—"}
                    </Link>
                  </td>
                  <td className="td font-medium text-fg">{d.deviceName || d.model || "—"}</td>
                  <td className="td">{d.modelNo || "—"}</td>
                  <td className="td">{d.serialImei || d.imei || "—"}</td>
                  <td className="td text-right">{d.qtyPurchased ?? 1}</td>
                  <td className="td">{d.vendorName || d.supplier?.name || "—"}</td>
                  <td className="td">{d.invoiceNo || "—"}</td>
                  <td className="td text-right whitespace-nowrap">{d.costMinor ? formatMoneyCompact(d.costMinor, d.currency as Currency) : "—"}</td>
                  <td className="td">{d.assignedTo || "—"}</td>
                  <td className="td">{d.projectClient || "—"}</td>
                  <td className="td">{d.location || "—"}</td>
                  <td className="td">
                    {d.statusText ? (
                      <span>{d.statusText}</span>
                    ) : (
                      <StatusBadge status={d.status} label={DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status} />
                    )}
                  </td>
                  <td className="td">{d.installedStatus || "—"}</td>
                  <td className="td">{d.installedBy || "—"}</td>
                  <td className="td max-w-[16rem]"><span className="line-clamp-2 text-xs text-muted">{d.notes || ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
