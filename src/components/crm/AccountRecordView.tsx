"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/ui";
import { InlineField } from "@/components/crm/InlineField";
import { Feed, NoteComposer, TaskComposer, type ActivityItem } from "@/components/crm/ActivityPanel";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/constants";
import {
  updateAccountField,
  addActivity,
  toggleActivityDone,
  deleteActivity,
} from "@/app/crm-actions";

export type { ActivityItem };
type ContactItem = { id: string; name: string; title: string | null; isPrimary: boolean; email: string | null; phone: string | null };
type DealItem = { id: string; title: string; stage: string; stageLabel: string; amountLabel: string };
type UserOpt = { id: string; name: string };
export type AccountData = {
  id: string;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  ownerId: string | null;
};

const TABS = ["Activity", "Notes", "Tasks", "Contacts", "Deals"] as const;
type Tab = (typeof TABS)[number];

export function AccountRecordView({
  account,
  users,
  activities,
  contacts,
  deals,
  editable,
}: {
  account: AccountData;
  users: UserOpt[];
  activities: ActivityItem[];
  contacts: ContactItem[];
  deals: DealItem[];
  editable: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Activity");
  const router = useRouter();

  const initials = account.name.trim().slice(0, 2).toUpperCase();
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "—" : null);
  const save = (field: string) => (value: string) => updateAccountField(account.id, field, value);

  const notes = activities.filter((a) => a.type === "NOTE");
  const tasks = activities.filter((a) => a.type === "TASK");

  return (
    <div className="lg:flex lg:gap-6">
      {/* MAIN — activity / tabs */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <Link href="/crm/accounts" className="hover:underline">Accounts</Link>
          <span>/</span>
          <span className="text-fg">{account.name}</span>
        </div>

        <div className="mb-4 flex items-center gap-2 border-b border-border">
          {TABS.map((t) => {
            const count = t === "Notes" ? notes.length : t === "Tasks" ? tasks.length : t === "Contacts" ? contacts.length : t === "Deals" ? deals.length : activities.length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {t} <span className="text-xs text-faint">{count}</span>
              </button>
            );
          })}
        </div>

        {(tab === "Activity" || tab === "Notes") && (
          <div className="space-y-4">
            {editable && (
              <NoteComposer
                onAdd={(text) =>
                  addActivity({ accountId: account.id, type: "NOTE", subject: text }).then((r) => {
                    if (!r || !("error" in r) || !r.error) router.refresh();
                    return r;
                  })
                }
              />
            )}
            <Feed
              items={tab === "Notes" ? notes : activities}
              editable={editable}
              onToggle={(id) => toggleActivityDone(id).then(() => router.refresh())}
              onDelete={(id) => deleteActivity(id).then(() => router.refresh())}
            />
          </div>
        )}

        {tab === "Tasks" && (
          <div className="space-y-4">
            {editable && (
              <TaskComposer
                onAdd={(subject, dueDate) =>
                  addActivity({ accountId: account.id, type: "TASK", subject, dueDate }).then((r) => {
                    if (!r || !("error" in r) || !r.error) router.refresh();
                    return r;
                  })
                }
              />
            )}
            <Feed
              items={tasks}
              editable={editable}
              onToggle={(id) => toggleActivityDone(id).then(() => router.refresh())}
              onDelete={(id) => deleteActivity(id).then(() => router.refresh())}
            />
          </div>
        )}

        {tab === "Contacts" && (
          <div className="space-y-3">
            {editable && (
              <Link href={`/crm/contacts/new?accountId=${account.id}`} className="btn-primary inline-flex">＋ Add contact</Link>
            )}
            {contacts.length === 0 ? (
              <p className="card p-4 text-sm text-muted">No contacts yet.</p>
            ) : (
              <div className="card divide-y divide-border">
                {contacts.map((c) => (
                  <Link key={c.id} href={`/crm/contacts/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                    <span className="text-sm text-fg">
                      {c.name}
                      {c.isPrimary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                      {c.title && <span className="block text-xs text-faint">{c.title}</span>}
                    </span>
                    <span className="text-xs text-faint">{c.email ?? c.phone ?? ""}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "Deals" && (
          <div className="space-y-3">
            {deals.length === 0 ? (
              <p className="card p-4 text-sm text-muted">No deals yet.</p>
            ) : (
              <div className="card divide-y divide-border">
                {deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-fg">{d.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-muted">{d.amountLabel}</span>
                      <StatusBadge status={d.stage} label={d.stageLabel} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT RAIL — record details, inline-editable */}
      <aside className="mt-6 shrink-0 border-t border-border pt-6 lg:mt-0 lg:w-80 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-fg">
              <InlineField value={account.name} placeholder="Account name" editable={editable} onSave={save("name")} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted">
              {account.phone && <a href={`tel:${account.phone}`} title="Call" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="phone" className="h-4 w-4" /></a>}
              {account.email && <a href={`mailto:${account.email}`} title="Email" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="mail" className="h-4 w-4" /></a>}
              {account.website && <a href={account.website} target="_blank" rel="noreferrer" title="Website" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="globe" className="h-4 w-4" /></a>}
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Details</p>
        <dl className="space-y-3">
          <Row label="Type">
            <InlineField
              value={account.type}
              kind="select"
              editable={editable}
              options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))}
              onSave={save("type")}
              render={(v) => <StatusBadge status={v} label={ACCOUNT_TYPE_LABELS[v as AccountType] ?? v} />}
            />
          </Row>
          <Row label="Owner">
            <InlineField
              value={account.ownerId ?? ""}
              kind="select"
              placeholder="Assign owner…"
              editable={editable}
              options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
              onSave={save("ownerId")}
              render={(v) => <>{userName(v) ?? "Unassigned"}</>}
            />
          </Row>
          <Row label="Website"><InlineField value={account.website ?? ""} placeholder="Add website…" kind="text" editable={editable} onSave={save("website")} /></Row>
          <Row label="Industry"><InlineField value={account.industry ?? ""} placeholder="Add industry…" editable={editable} onSave={save("industry")} /></Row>
          <Row label="Email"><InlineField value={account.email ?? ""} placeholder="Add email…" kind="email" editable={editable} onSave={save("email")} /></Row>
          <Row label="Phone"><InlineField value={account.phone ?? ""} placeholder="Add phone…" kind="tel" editable={editable} onSave={save("phone")} /></Row>
          <Row label="GSTIN"><InlineField value={account.gstin ?? ""} placeholder="Add GSTIN…" editable={editable} onSave={save("gstin")} /></Row>
          <Row label="Address"><InlineField value={account.address ?? ""} placeholder="Add address…" kind="textarea" editable={editable} onSave={save("address")} /></Row>
          <Row label="Notes"><InlineField value={account.notes ?? ""} placeholder="Add notes…" kind="textarea" editable={editable} onSave={save("notes")} /></Row>
        </dl>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-start gap-2">
      <dt className="pt-0.5 text-xs text-faint">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
