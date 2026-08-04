import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { DEAL_STAGE_LABELS, type DealStage, type Currency } from "@/lib/constants";
import { DeleteButton } from "@/components/DeleteButton";
import { AccountRecordView } from "@/components/crm/AccountRecordView";
import { deleteAccount, toggleAccountActive } from "@/app/crm-actions";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      deals: { orderBy: { createdAt: "desc" } },
      activities: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        include: { contact: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!account) notFound();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const activities = account.activities.map((a) => ({
    id: a.id,
    type: a.type,
    subject: a.subject,
    body: a.body,
    status: a.status,
    whenLabel: format(a.occurredAt, "d MMM yyyy"),
    dueLabel: a.dueDate ? format(a.dueDate, "d MMM yyyy") : null,
    contactName: a.contact ? `${a.contact.firstName} ${a.contact.lastName}`.trim() : null,
  }));

  const contacts = account.contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    title: c.title,
    isPrimary: c.isPrimary,
    email: c.email,
    phone: c.phone,
  }));

  const deals = account.deals.map((d) => ({
    id: d.id,
    title: d.title,
    stage: d.stage,
    stageLabel: DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage,
    amountLabel: formatMoney(d.amountMinor, d.currency as Currency),
  }));

  return (
    <div>
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <form action={toggleAccountActive.bind(null, account.id)}>
            <button className="text-xs font-medium text-muted hover:underline">{account.active ? "Deactivate" : "Activate"}</button>
          </form>
          <DeleteButton
            action={deleteAccount.bind(null, account.id)}
            label="Delete"
            className="text-xs font-medium text-red-600 hover:underline"
            confirmText={`Delete ${account.name}? This can't be undone. Contacts and deals are kept (unlinked); activities are removed.`}
          />
        </div>
      )}

      <AccountRecordView
        account={{
          id: account.id,
          name: account.name,
          type: account.type,
          industry: account.industry,
          website: account.website,
          email: account.email,
          phone: account.phone,
          address: account.address,
          gstin: account.gstin,
          notes: account.notes,
          ownerId: account.ownerId,
        }}
        users={users}
        activities={activities}
        contacts={contacts}
        deals={deals}
        editable={editable}
      />
    </div>
  );
}
