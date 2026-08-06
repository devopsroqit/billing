import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { DEAL_STAGE_LABELS, type DealStage, type Currency } from "@/lib/constants";
import { CompanyRecordView } from "@/components/crm/CompanyRecordView";
import { toTaskItem } from "@/lib/tasks";
import { toAuditItem, toNoteItem } from "@/lib/crm-feed";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      deals: { orderBy: { createdAt: "desc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { comments: { orderBy: { createdAt: "asc" } } },
      },
      noteEntries: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] },
    },
  });
  if (!company) notFound();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const contacts = company.contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    title: c.title,
    isPrimary: c.isPrimary,
    email: c.email,
    phone: c.phone,
  }));

  const deals = company.deals.map((d) => ({
    id: d.id,
    title: d.title,
    stage: d.stage,
    stageLabel: DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage,
    amountLabel: formatMoney(d.amountMinor, d.currency as Currency),
  }));

  const userNameMap = new Map(users.map((u) => [u.id, u.name]));
  const userName = (id: string | null) => (id ? userNameMap.get(id) ?? "—" : null);
  const taskItems = company.tasks.map((t) => toTaskItem(t, userName));
  const auditItems = company.activities.map((a) => toAuditItem(a, userName));
  const noteItems = company.noteEntries.map((n) => toNoteItem(n, userName));

  return (
    <div>
      <CompanyRecordView
        company={{
          id: company.id,
          name: company.name,
          relationshipType: company.relationshipType,
          source: company.source,
          size: company.size,
          domains: company.domains,
          categories: company.categories,
          primaryLocation: company.primaryLocation,
          teamSize: company.teamSize,
          description: company.description,
          email: company.email,
          phone: company.phone,
          gstin: company.gstin,
          ownerId: company.ownerId,
          active: company.active,
        }}
        users={users}
        auditItems={auditItems}
        noteItems={noteItems}
        taskItems={taskItems}
        contacts={contacts}
        deals={deals}
        editable={editable}
      />
    </div>
  );
}
