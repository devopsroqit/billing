import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { RELATIONSHIP_TYPE_LABELS, type RelationshipType } from "@/lib/constants";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

// GET /api/export/companies?q=&type=&category=  → downloads the (filtered)
// company book as .xlsx, respecting the same URL params the list page uses.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const type = (req.nextUrl.searchParams.get("type") ?? "").trim();
  const category = (req.nextUrl.searchParams.get("category") ?? "").trim();

  const where: Record<string, unknown> = {};
  if (type) where.relationshipType = type;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { domains: { contains: q, mode: "insensitive" } },
      { primaryLocation: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.categories = { contains: category, mode: "insensitive" };

  const [companies, users] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { contacts: true, deals: true } } },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "ROQIT Billing";
  wb.created = new Date();
  const ws = wb.addWorksheet("Companies");

  ws.columns = [
    { header: "S.No", key: "sno", width: 6 },
    { header: "Name", key: "name", width: 28 },
    { header: "Relationship", key: "type", width: 16 },
    { header: "Owner", key: "owner", width: 18 },
    { header: "Location", key: "location", width: 24 },
    { header: "Domains", key: "domains", width: 24 },
    { header: "Email", key: "email", width: 24 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Categories", key: "categories", width: 24 },
    { header: "Contacts", key: "contacts", width: 10 },
    { header: "Deals", key: "deals", width: 10 },
    { header: "Active", key: "active", width: 8 },
    { header: "Created", key: "created", width: 14 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  });

  companies.forEach((c, i) => {
    ws.addRow({
      sno: i + 1,
      name: c.name,
      type: RELATIONSHIP_TYPE_LABELS[c.relationshipType as RelationshipType] ?? c.relationshipType,
      owner: c.ownerId ? userName.get(c.ownerId) ?? "" : "",
      location: c.primaryLocation ?? "",
      domains: c.domains ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      categories: c.categories ?? "",
      contacts: c._count.contacts,
      deals: c._count.deals,
      active: c.active ? "Yes" : "No",
      created: fmtDate(c.createdAt),
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="roqit-companies-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
