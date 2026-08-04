import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DEVICE_STATUS_LABELS, type DeviceStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// GET /api/export/devices?status=&supplierId=&q=  → downloads the (filtered) inventory as .xlsx
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || "";
  const supplierId = req.nextUrl.searchParams.get("supplierId") || "";
  const q = req.nextUrl.searchParams.get("q") || "";

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
      { imei: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
    ];
  }

  const devices = await prisma.device.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { supplier: true },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ROQIT Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet("Inventory Register");

  // Same columns as the import template, so exports round-trip cleanly.
  ws.columns = [
    { header: "S.No", key: "sno", width: 6 },
    { header: "Date", key: "date", width: 14 },
    { header: "Device ID", key: "deviceId", width: 16 },
    { header: "Device Name", key: "deviceName", width: 22 },
    { header: "Model No", key: "modelNo", width: 18 },
    { header: "Serial No / IMEI", key: "serialImei", width: 20 },
    { header: "Qty Purchased", key: "qty", width: 12 },
    { header: "Vendor Name", key: "vendor", width: 18 },
    { header: "Invoice No", key: "invoice", width: 16 },
    { header: "Purchase Cost", key: "cost", width: 14 },
    { header: "Assigned To", key: "assignedTo", width: 16 },
    { header: "Project / Client", key: "project", width: 18 },
    { header: "Location", key: "location", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Installed Status", key: "installed", width: 14 },
    { header: "Installed by", key: "installedBy", width: 16 },
    { header: "Remarks", key: "remarks", width: 28 },
  ];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });

  devices.forEach((d, i) => {
    ws.addRow({
      sno: i + 1,
      date: fmtDate(d.purchaseDate),
      deviceId: d.assetTag ?? "",
      deviceName: d.deviceName ?? d.model ?? "",
      modelNo: d.modelNo ?? "",
      serialImei: d.serialImei ?? d.imei ?? "",
      qty: d.qtyPurchased ?? 1,
      vendor: d.vendorName ?? d.supplier?.name ?? "",
      invoice: d.invoiceNo ?? "",
      cost: d.costMinor ? d.costMinor / 100 : "",
      assignedTo: d.assignedTo ?? "",
      project: d.projectClient ?? "",
      location: d.location ?? "",
      status: d.statusText ?? (DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status),
      installed: d.installedStatus ?? "",
      installedBy: d.installedBy ?? "",
      remarks: d.notes ?? "",
    });
  });

  ws.getColumn("cost").numFmt = "#,##0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roqit-devices-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
