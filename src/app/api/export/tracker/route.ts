import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  monthLabel,
  MONTH_NAMES,
  VENDOR_TYPE_LABELS,
  BILLING_FREQUENCY_LABELS,
  ENTRY_STATUS_LABELS,
  type VendorType,
  type BillingFrequency,
  type EntryStatus,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

const minor = (n: number) => n / 100;
const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// GET /api/export/tracker?y=2026&m=7  → downloads that month as .xlsx
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const year = Number(req.nextUrl.searchParams.get("y")) || now.getFullYear();
  const month = Number(req.nextUrl.searchParams.get("m")) || now.getMonth() + 1;

  const entries = await prisma.paymentEntry.findMany({
    where: { periodYear: year, periodMonth: month },
    orderBy: [{ status: "asc" }, { serviceName: "asc" }],
    include: { documents: true },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "roqit Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet(`${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`);

  ws.columns = [
    { header: "Service", key: "service", width: 20 },
    { header: "Type", key: "type", width: 14 },
    { header: "Billing Frequency", key: "freq", width: 18 },
    { header: "Due date", key: "due", width: 14 },
    { header: "Payment Made on", key: "paidOn", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Amount (INR)", key: "inr", width: 14 },
    { header: "Amount (USD)", key: "usd", width: 14 },
    { header: "Amount (EUR)", key: "eur", width: 14 },
    { header: "This Month Paid (INR)", key: "paid", width: 20 },
    { header: "Notes", key: "notes", width: 32 },
    { header: "Documents", key: "docs", width: 36 },
  ];

  // Header styling.
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F86C6" } };
  });

  for (const e of entries) {
    ws.addRow({
      service: e.serviceName,
      type: VENDOR_TYPE_LABELS[e.vendorType as VendorType] ?? e.vendorType,
      freq: BILLING_FREQUENCY_LABELS[e.billingFrequency as BillingFrequency] ?? e.billingFrequency,
      due: fmtDate(e.dueDate),
      paidOn: fmtDate(e.paymentMadeOn),
      status: ENTRY_STATUS_LABELS[e.status as EntryStatus] ?? e.status,
      inr: minor(e.amountInrPaise),
      usd: minor(e.amountUsdCents),
      eur: minor(e.amountEurCents),
      paid: minor(e.thisMonthPaidInrPaise),
      notes: e.notes ?? "",
      docs: e.documents.map((d) => (d.kind === "LINK" ? `${d.title} (${d.externalUrl})` : d.title)).join("; "),
    });
  }

  // Totals row.
  const totals = entries.reduce(
    (a, e) => ({
      inr: a.inr + e.amountInrPaise,
      usd: a.usd + e.amountUsdCents,
      eur: a.eur + e.amountEurCents,
      paid: a.paid + e.thisMonthPaidInrPaise,
    }),
    { inr: 0, usd: 0, eur: 0, paid: 0 },
  );
  const totalRow = ws.addRow({
    service: "Total",
    inr: minor(totals.inr),
    usd: minor(totals.usd),
    eur: minor(totals.eur),
    paid: minor(totals.paid),
  });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF3F9" } };
  });

  // Currency number formats.
  ws.getColumn("inr").numFmt = '#,##0.00';
  ws.getColumn("usd").numFmt = '#,##0.00';
  ws.getColumn("eur").numFmt = '#,##0.00';
  ws.getColumn("paid").numFmt = '#,##0.00';

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `roqit-tracker-${year}-${String(month).padStart(2, "0")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
