import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DEAL_STAGE_LABELS, type DealStage } from "@/lib/constants";
import { minorToMajor } from "@/lib/money";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// GET /api/export/deals?q=&stage=  → downloads the (filtered) pipeline as .xlsx
// Filters honour the same ?q & ?stage params the list page uses so an export
// mirrors what's on screen. Session-gated, read-only.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const stage = (req.nextUrl.searchParams.get("stage") ?? "").trim();

  const where: Record<string, unknown> = {};
  if (stage) where.stage = stage;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [deals, users] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "ROQIT Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet("Deals");

  ws.columns = [
    { header: "S.No", key: "sno", width: 6 },
    { header: "Deal", key: "title", width: 32 },
    { header: "Company", key: "company", width: 24 },
    { header: "Stage", key: "stage", width: 20 },
    { header: "Owner", key: "owner", width: 18 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "ARR", key: "arr", width: 14 },
    { header: "Commercial", key: "commercial", width: 14 },
    { header: "Contract signed", key: "signed", width: 14 },
    { header: "1st invoice", key: "firstInvoice", width: 14 },
    { header: "1st payment", key: "firstPayment", width: 14 },
    { header: "Loss reason", key: "lossReason", width: 24 },
    { header: "Active", key: "active", width: 8 },
    { header: "Created", key: "created", width: 14 },
    { header: "Updated", key: "updated", width: 14 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });

  deals.forEach((d, i) => {
    ws.addRow({
      sno: i + 1,
      title: d.title,
      company: d.company?.name ?? "",
      stage: DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage,
      owner: d.ownerId ? userName.get(d.ownerId) ?? "" : "",
      amount: d.amountMinor ? minorToMajor(d.amountMinor) : "",
      currency: d.currency,
      arr: d.arrMinor ? minorToMajor(d.arrMinor) : "",
      commercial: d.commercialModel ?? "",
      signed: fmtDate(d.contractSignedDate),
      firstInvoice: fmtDate(d.firstInvoiceDate),
      firstPayment: fmtDate(d.firstPaymentDate),
      lossReason: d.lossReason ?? "",
      active: d.active ? "Yes" : "No",
      created: fmtDate(d.createdAt),
      updated: fmtDate(d.updatedAt),
    });
  });

  ws.getColumn("amount").numFmt = "#,##0.00";
  ws.getColumn("arr").numFmt = "#,##0.00";
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roqit-deals-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
