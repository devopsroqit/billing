import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { DeleteButton } from "@/components/DeleteButton";
import { DealRecordView } from "@/components/crm/DealRecordView";
import { deleteDeal } from "@/app/crm-actions";

export const dynamic = "force-dynamic";

const asDateInput = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      activities: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: { contact: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!deal) notFound();

  const [companies, users, contacts] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    deal.companyId
      ? prisma.contact.findMany({
          where: { companyId: deal.companyId },
          orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true, title: true, isPrimary: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const activities = deal.activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    status: a.status,
    whenLabel: format(a.occurredAt, "d MMM yyyy"),
    dueLabel: a.dueDate ? format(a.dueDate, "d MMM yyyy") : null,
    contactName: a.contact ? `${a.contact.firstName} ${a.contact.lastName}`.trim() : null,
  }));

  const people = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    title: c.title,
    isPrimary: c.isPrimary,
    email: c.email,
  }));

  // Earliest open task → the "Next due task" highlight.
  const nextTask = deal.activities
    .filter((a) => a.type === "TASK" && a.status === "OPEN")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];
  const nextDueTaskLabel = nextTask
    ? `${nextTask.subject}${nextTask.dueDate ? ` · due ${format(nextTask.dueDate, "d MMM yyyy")}` : ""}`
    : null;

  return (
    <div>
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <DeleteButton
            action={deleteDeal.bind(null, deal.id)}
            label="Delete"
            className="text-xs font-medium text-red-600 hover:underline"
            confirmText={`Delete ${deal.title}? This can't be undone. Activities on the deal are removed.`}
          />
        </div>
      )}

      <DealRecordView
        deal={{
          id: deal.id,
          title: deal.title,
          stage: deal.stage,
          commercialModel: deal.commercialModel,
          currency: deal.currency,
          amountMinor: deal.amountMinor,
          arrMinor: deal.arrMinor,
          assetsInScope: deal.assetsInScope,
          packsInScope: deal.packsInScope,
          nextAction: deal.nextAction,
          companyId: deal.companyId,
          ownerId: deal.ownerId,
          contractSignedDate: asDateInput(deal.contractSignedDate),
          firstInvoiceDate: asDateInput(deal.firstInvoiceDate),
          firstPaymentDate: asDateInput(deal.firstPaymentDate),
          lossReason: deal.lossReason,
          notes: deal.notes,
        }}
        companies={companies}
        users={users}
        activities={activities}
        people={people}
        nextDueTaskLabel={nextDueTaskLabel}
        editable={editable}
      />
    </div>
  );
}
