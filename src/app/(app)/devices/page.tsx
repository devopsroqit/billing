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
import { PageHeader, EmptyState } from "@/components/ui";
import { DeviceBulkUpload } from "@/components/DeviceBulkUpload";
import { DevicesTable, type DeviceRow } from "@/components/DevicesTable";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { status?: string; supplierId?: string; purchaseId?: string; q?: string };
}) {
  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const status = searchParams.status?.trim() || "";
  const supplierId = searchParams.supplierId?.trim() || "";
  const purchaseId = searchParams.purchaseId?.trim() || "";
  const q = searchParams.q?.trim() || "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  // "none" is the special "Unlinked" filter → devices with no purchase.
  if (purchaseId === "none") where.purchaseId = null;
  else if (purchaseId) where.purchaseId = purchaseId;
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

  const [devices, suppliers, purchases, total] = await Promise.all([
    prisma.device.findMany({ where, orderBy: { createdAt: "desc" }, include: { supplier: true }, take: 1000 }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true }, take: 200 }),
    prisma.device.count(),
  ]);

  const purchaseOptions = purchases.map((p) => ({
    id: p.id,
    label: `${p.reference || format(p.purchaseDate, "d MMM yyyy")}${p.supplier ? ` · ${p.supplier.name}` : ""}`,
  }));

  // Pre-format each device into a plain, serializable row for the client table.
  const rows: DeviceRow[] = devices.map((d) => ({
    id: d.id,
    dateLabel: d.purchaseDate ? format(d.purchaseDate, "d-MMM-yy") : "—",
    assetTag: d.assetTag ?? null,
    deviceName: d.deviceName || d.model || "—",
    modelNo: d.modelNo || "—",
    serialImei: d.serialImei || d.imei || "—",
    qty: d.qtyPurchased ?? 1,
    vendor: d.vendorName || d.supplier?.name || "—",
    invoiceNo: d.invoiceNo || "—",
    costLabel: d.costMinor ? formatMoneyCompact(d.costMinor, d.currency as Currency) : "—",
    assignedTo: d.assignedTo || "—",
    projectClient: d.projectClient || "—",
    location: d.location || "—",
    statusText: d.statusText || null,
    status: d.status,
    statusLabel: DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status,
    installedStatus: d.installedStatus || "—",
    installedBy: d.installedBy || "—",
    notes: d.notes || "",
  }));

  const queryStr = new URLSearchParams({
    ...(status && { status }),
    ...(supplierId && { supplierId }),
    ...(purchaseId && { purchaseId }),
    ...(q && { q }),
  }).toString();

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
        <div>
          <label className="label">Purchase</label>
          <select className="input" name="purchaseId" defaultValue={purchaseId}>
            <option value="">All purchases</option>
            <option value="none">— Unlinked (no purchase) —</option>
            {purchaseOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {(status || supplierId || purchaseId || q) && <Link href="/devices" className="btn-secondary">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No devices found"
          hint={(status || supplierId || purchaseId || q) ? "Try clearing the filters." : "Add IoT devices individually, upload a spreadsheet, or link them to a purchase order."}
          action={
            (status || supplierId || purchaseId || q)
              ? <Link href="/devices" className="btn-secondary">Clear filters</Link>
              : editable ? <Link href="/devices/new" className="btn-primary">Add your first device</Link> : null
          }
        />
      ) : (
        <DevicesTable rows={rows} purchases={purchaseOptions} editable={editable} />
      )}
    </div>
  );
}
