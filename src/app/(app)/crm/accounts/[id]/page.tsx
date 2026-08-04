import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import {
  ACCOUNT_TYPE_LABELS,
  DEAL_STAGE_LABELS,
  ACTIVITY_TYPE_LABELS,
  DEVICE_STATUS_LABELS,
  type AccountType,
  type DealStage,
  type Currency,
  type DeviceStatus,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteAccount, toggleAccountActive } from "@/app/crm-actions";

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

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = canEdit(me.role);

  const account = await prisma.account.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }] },
      deals: { orderBy: { createdAt: "desc" } },
      devices: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!account) notFound();

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.name}
        subtitle={account.industry ?? undefined}
        action={
          editable ? (
            <div className="flex items-center gap-2">
              <Link href={`/crm/accounts/${account.id}/edit`} className="btn-secondary">Edit</Link>
              <Link href={`/crm/contacts/new?accountId=${account.id}`} className="btn-primary">Add contact</Link>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={account.type} label={ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type} />
        <StatusBadge status={account.active ? "ACTIVE" : "INACTIVE"} label={account.active ? "Active" : "Inactive"} />
        {account.ownerId && <span className="text-sm text-muted">Owner: {userName.get(account.ownerId) ?? "—"}</span>}
      </div>

      {/* Profile */}
      <div className="card grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Website" value={account.website} />
        <Field label="Email" value={account.email} />
        <Field label="Phone" value={account.phone} />
        <Field label="GSTIN" value={account.gstin} />
        <Field label="Address" value={account.address} />
        <Field label="Notes" value={account.notes} />
      </div>

      {/* Contacts */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Contacts ({account.contacts.length})</h2>
        {account.contacts.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No contacts yet.</p>
        ) : (
          <div className="card divide-y divide-border">
            {account.contacts.map((c) => (
              <Link key={c.id} href={`/crm/contacts/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                <span className="text-sm text-fg">
                  {c.firstName} {c.lastName}
                  {c.isPrimary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                  {c.title && <span className="block text-xs text-faint">{c.title}</span>}
                </span>
                <span className="text-xs text-faint">{c.email ?? c.phone ?? ""}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Deals */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Deals ({account.deals.length})</h2>
        {account.deals.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No deals yet.</p>
        ) : (
          <div className="card divide-y divide-border">
            {account.deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-fg">{d.title}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm text-muted">{formatMoney(d.amountMinor, d.currency as Currency)}</span>
                  <StatusBadge status={d.stage} label={DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Recent activity</h2>
        {account.activities.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No activity logged yet.</p>
        ) : (
          <div className="card divide-y divide-border">
            {account.activities.map((a) => (
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

      {/* Linked devices */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">Linked devices ({account.devices.length})</h2>
        {account.devices.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No devices linked to this account.</p>
        ) : (
          <div className="card divide-y divide-border">
            {account.devices.map((dev) => (
              <Link key={dev.id} href={`/devices/${dev.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                <span className="text-sm text-fg">
                  {dev.deviceName ?? dev.model ?? dev.category}
                  {dev.serialNo && <span className="block text-xs text-faint">SN: {dev.serialNo}</span>}
                </span>
                <StatusBadge status={dev.status} label={DEVICE_STATUS_LABELS[dev.status as DeviceStatus] ?? dev.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      {account.documents.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-fg">Documents ({account.documents.length})</h2>
          <div className="card divide-y divide-border">
            {account.documents.map((doc) => (
              <a key={doc.id} href={`/api/documents/${doc.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2" target="_blank" rel="noreferrer">
                <span className="text-sm text-fg">{doc.title}</span>
                <span className="text-xs text-faint">{doc.kind}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Danger zone */}
      {editable && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-medium text-fg">Danger zone</p>
          <p className="mt-1 text-xs text-muted">
            Deleting removes the account. Its contacts and deals are kept (unlinked); activities and attached documents are removed.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <form action={toggleAccountActive.bind(null, account.id)}>
              <button className="btn-secondary">{account.active ? "Deactivate" : "Activate"}</button>
            </form>
            <DeleteButton
              action={deleteAccount.bind(null, account.id)}
              label="Delete account"
              className="btn-secondary text-red-600"
              confirmText={`Delete ${account.name}? This can't be undone.`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
