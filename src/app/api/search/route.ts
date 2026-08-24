import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, dealAccessWhere } from "@/lib/auth";
import { DEAL_STAGE_LABELS, DEVICE_STATUS_LABELS, type DealStage, type DeviceStatus } from "@/lib/constants";

// GET /api/search?q=<term>
// Global search across the four CRM/asset record types: companies, contacts,
// deals, and devices. Signed-in users only. Each match is a compact shape
// { kind, id, title, subtitle, href } the client renders as a menu row.
//
// Read-only. Case-insensitive substring on each entity's most searchable
// fields. Capped at ~5 rows per kind so a broad query stays snappy — no
// pagination here, viewers refine the query.

export const dynamic = "force-dynamic";

type Hit = {
  kind: "deal" | "company" | "contact" | "device";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const PER_KIND = 5;

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const contains = { contains: q, mode: "insensitive" as const };

  const [deals, companies, contacts, devices] = await Promise.all([
    prisma.deal.findMany({
      // Non-admins only see deals they're on. Applies here too — search must
      // never surface a deal the user can't open.
      where: { AND: [dealAccessWhere(me), { title: contains }] },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
      include: { company: { select: { name: true } } },
    }),
    prisma.company.findMany({
      where: {
        OR: [{ name: contains }, { primaryLocation: contains }, { domains: contains }],
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: PER_KIND,
    }),
    prisma.contact.findMany({
      where: {
        OR: [
          { firstName: contains },
          { lastName: contains },
          { email: contains },
          { phone: contains },
        ],
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: PER_KIND,
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.device.findMany({
      where: {
        OR: [
          { assetTag: contains },
          { deviceName: contains },
          { modelNo: contains },
          { serialImei: contains },
          { imei: contains },
          { serialNo: contains },
          { assignedTo: contains },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
    }),
  ]);

  const results: Hit[] = [
    ...deals.map<Hit>((d) => ({
      kind: "deal",
      id: d.id,
      title: d.title,
      subtitle: [d.company?.name, DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage].filter(Boolean).join(" · "),
      href: `/crm/deals/${d.id}`,
    })),
    ...companies.map<Hit>((c) => ({
      kind: "company",
      id: c.id,
      title: c.name,
      subtitle: c.primaryLocation ?? c.domains ?? null,
      href: `/crm/companies/${c.id}`,
    })),
    ...contacts.map<Hit>((c) => ({
      kind: "contact",
      id: c.id,
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: [c.title, c.company?.name].filter(Boolean).join(" · ") || c.email,
      // Contacts don't have their own detail page in the current app — deep-link
      // to the company they belong to when possible.
      href: c.company ? `/crm/companies/${c.company.id}` : `/crm/contacts/${c.id}`,
    })),
    ...devices.map<Hit>((d) => ({
      kind: "device",
      id: d.id,
      title: d.deviceName || d.assetTag || d.serialImei || d.imei || d.model || "Device",
      subtitle: [d.assetTag, DEVICE_STATUS_LABELS[d.status as DeviceStatus] ?? d.status, d.assignedTo].filter(Boolean).join(" · "),
      href: `/devices/${d.id}`,
    })),
  ];

  return NextResponse.json({ results });
}
