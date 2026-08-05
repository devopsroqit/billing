import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { DeleteButton } from "@/components/DeleteButton";
import { ContactRecordView } from "@/components/crm/ContactRecordView";
import { toTaskItem } from "@/lib/tasks";
import { toAuditItem, toNoteItem } from "@/lib/crm-feed";
import { deleteContact } from "@/app/crm-actions";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      activities: {
        orderBy: { createdAt: "desc" },
        include: { comments: { orderBy: { createdAt: "asc" } } },
      },
      noteEntries: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }] },
    },
  });
  if (!contact) notFound();

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const userNameMap = new Map(users.map((u) => [u.id, u.name]));
  const userName = (id: string | null) => (id ? userNameMap.get(id) ?? "—" : null);
  const taskItems = contact.tasks.map((t) => toTaskItem(t, userName));
  const auditItems = contact.activities.map((a) => toAuditItem(a, userName));
  const noteItems = contact.noteEntries.map((n) => toNoteItem(n, userName));

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  return (
    <div>
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2">
          <DeleteButton
            action={deleteContact.bind(null, contact.id)}
            label="Delete"
            className="text-xs font-medium text-red-600 hover:underline"
            confirmText={`Delete ${fullName}? This can't be undone.`}
          />
        </div>
      )}

      <ContactRecordView
        contact={{
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes,
          isPrimary: contact.isPrimary,
          companyId: contact.companyId,
          ownerId: contact.ownerId,
        }}
        companies={companies}
        users={users}
        auditItems={auditItems}
        noteItems={noteItems}
        taskItems={taskItems}
        editable={editable}
      />
    </div>
  );
}
