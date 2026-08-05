import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { DEAL_STAGE_LABELS, type DealStage, type Currency } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import { CompanyRecordView } from "@/components/crm/CompanyRecordView";
import { toTaskItem } from "@/lib/tasks";
import { deleteCompany, toggleCompanyActive } from "@/app/crm-actions";

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
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: { contact: { select: { firstName: true, lastName: true } } },
      },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] },
    },
  });
  if (!company) notFound();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const activities = company.activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    status: a.status,
    whenLabel: format(a.occurredAt, "d MMM yyyy"),
    dueLabel: a.dueDate ? format(a.dueDate, "d MMM yyyy") : null,
    contactName: a.contact ? `${a.contact.firstName} ${a.contact.lastName}`.trim() : null,
  }));

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
  const taskItems = company.tasks.map((t) => toTaskItem(t, (id) => (id ? userNameMap.get(id) ?? "—" : null)));

  return (
    <div>
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <form action={toggleCompanyActive.bind(null, company.id)}>
            <button className="text-xs font-medium text-muted hover:underline">{company.active ? "Deactivate" : "Activate"}</button>
          </form>
          <DeleteButton
            action={deleteCompany.bind(null, company.id)}
            label="Delete"
            className="text-xs font-medium text-red-600 hover:underline"
            confirmText={`Delete ${company.name}? This can't be undone. Contacts and deals are kept (unlinked); activities are removed.`}
          />
        </div>
      )}

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
        }}
        users={users}
        activities={activities}
        taskItems={taskItems}
        contacts={contacts}
        deals={deals}
        editable={editable}
      />
    </div>
  );
}
