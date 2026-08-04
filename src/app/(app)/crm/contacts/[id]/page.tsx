import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { ACTIVITY_TYPE_LABELS } from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteContact } from "@/app/crm-actions";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className="text-sm text-fg">{value}</p>
    </div>
  );
}

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      account: { select: { id: true, name: true } },
      activities: { orderBy: { occurredAt: "desc" }, take: 20 },
    },
  });
  if (!contact) notFound();

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        subtitle={contact.title ?? undefined}
        action={editable ? <Link href={`/crm/contacts/${contact.id}/edit`} className="btn-secondary">Edit</Link> : null}
      />

      <div className="flex flex-wrap items-center gap-2">
        {contact.isPrimary && <StatusBadge status="PARTNER" label="Primary contact" />}
        {contact.account && (
          <span className="text-sm text-muted">
            Account: <Link href={`/crm/accounts/${contact.account.id}`} className="text-brand-600 hover:underline">{contact.account.name}</Link>
          </span>
        )}
      </div>

      <div className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Email" value={contact.email} />
        <Field label="Phone" value={contact.phone} />
        <Field label="Job title" value={contact.title} />
        <Field label="Notes" value={contact.notes} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Recent activity</h2>
        {contact.activities.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No activity logged for this contact yet.</p>
        ) : (
          <div className="card divide-y divide-border">
            {contact.activities.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-fg">
                    <span className="mr-2 text-xs uppercase tracking-wide text-faint">{ACTIVITY_TYPE_LABELS[a.type as keyof typeof ACTIVITY_TYPE_LABELS] ?? a.type}</span>
                    {a.subject}
                  </span>
                  <span className="text-xs text-faint">{format(a.occurredAt, "d MMM yyyy")}</span>
                </div>
                {a.body && <p className="mt-1 text-sm text-muted">{a.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {editable && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-fg">Danger zone</p>
          <p className="mt-1 text-xs text-muted">Deleting removes this contact. Their logged activities are kept (unlinked).</p>
          <div className="mt-3">
            <DeleteButton
              action={deleteContact.bind(null, contact.id)}
              label="Delete contact"
              className="btn-secondary text-red-600"
              confirmText={`Delete ${fullName}? This can't be undone.`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
