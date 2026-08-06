import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { DocumentForm, DeleteDocButton } from "@/components/DocumentForm";
import { DealRecordView } from "@/components/crm/DealRecordView";
import { toTaskItem } from "@/lib/tasks";
import { toAuditItem, toNoteItem } from "@/lib/crm-feed";
import { isTaskClosed } from "@/lib/constants";

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
        orderBy: { createdAt: "desc" },
        include: { comments: { orderBy: { createdAt: "asc" } } },
      },
      noteEntries: { orderBy: { createdAt: "desc" } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
      tasks: {
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      },
      contributors: { orderBy: { createdAt: "asc" }, select: { userId: true } },
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

  const people = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    title: c.title,
    isPrimary: c.isPrimary,
    email: c.email,
  }));

  const userNameMap = new Map(users.map((u) => [u.id, u.name]));
  const userName = (id: string | null) => (id ? userNameMap.get(id) ?? "—" : null);
  const taskItems = deal.tasks.map((t) => toTaskItem(t, userName));
  const auditItems = deal.activities.map((a) => toAuditItem(a, userName));
  const noteItems = deal.noteEntries.map((n) => toNoteItem(n, userName));
  const contributorIds = deal.contributors.map((c) => c.userId);

  // Earliest open (not closed) task with a due date → the "Next due task" highlight.
  const nextTask = deal.tasks
    .filter((t) => !isTaskClosed(t.status) && t.dueAt)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))[0];
  const nextDueTaskLabel = nextTask
    ? `${nextTask.title}${nextTask.dueAt ? ` · due ${format(nextTask.dueAt, "d MMM yyyy")}` : ""}`
    : null;

  const documentsSlot = (
    <>
      {deal.documents.length === 0 ? (
        <p className="card p-4 text-sm text-muted">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {deal.documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                {doc.kind === "LINK" ? (
                  <a href={doc.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-600 hover:underline">🔗 {doc.title}</a>
                ) : (
                  <a href={`/api/documents/${doc.id}`} className="truncate text-sm text-brand-600 hover:underline">📄 {doc.title}</a>
                )}
                <p className="text-[11px] text-faint">{doc.uploadedBy?.name ?? "—"} · {format(doc.createdAt, "d MMM yyyy")}</p>
              </div>
              {editable && <DeleteDocButton id={doc.id} />}
            </li>
          ))}
        </ul>
      )}
      {editable && <DocumentForm dealId={deal.id} />}
    </>
  );

  return (
    <div>
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
          active: deal.active,
          projectCompletedLabel: deal.projectCompletedAt ? format(deal.projectCompletedAt, "d MMM yyyy") : null,
        }}
        companies={companies}
        users={users}
        auditItems={auditItems}
        noteItems={noteItems}
        taskItems={taskItems}
        people={people}
        contributorIds={contributorIds}
        nextDueTaskLabel={nextDueTaskLabel}
        documentsSlot={documentsSlot}
        docCount={deal.documents.length}
        editable={editable}
      />
    </div>
  );
}
