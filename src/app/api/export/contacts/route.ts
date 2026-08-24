import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// GET /api/export/contacts?q=  → downloads the (filtered) contact book as .xlsx
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { company: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: { company: { select: { name: true } } },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "ROQIT Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet("Contacts");

  ws.columns = [
    { header: "S.No", key: "sno", width: 6 },
    { header: "First name", key: "firstName", width: 18 },
    { header: "Last name", key: "lastName", width: 18 },
    { header: "Title", key: "title", width: 22 },
    { header: "Company", key: "company", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Primary", key: "primary", width: 8 },
    { header: "Notes", key: "notes", width: 32 },
    { header: "Created", key: "created", width: 14 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });

  contacts.forEach((c, i) => {
    ws.addRow({
      sno: i + 1,
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title ?? "",
      company: c.company?.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      primary: c.isPrimary ? "Yes" : "",
      notes: c.notes ?? "",
      created: fmtDate(c.createdAt),
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roqit-contacts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
