"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { InlineField } from "@/components/crm/InlineField";
import { Feed, NoteComposer, TaskComposer, type ActivityItem } from "@/components/crm/ActivityPanel";
import {
  updateContactField,
  addActivity,
  toggleActivityDone,
  deleteActivity,
} from "@/app/crm-actions";

type Option = { id: string; name: string };
export type ContactData = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
  accountId: string | null;
  ownerId: string | null;
};

const TABS = ["Activity", "Notes", "Tasks"] as const;
type Tab = (typeof TABS)[number];

export function ContactRecordView({
  contact,
  accounts,
  users,
  activities,
  editable,
}: {
  contact: ContactData;
  accounts: Option[];
  users: Option[];
  activities: ActivityItem[];
  editable: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Activity");
  const router = useRouter();

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const initials = fullName.slice(0, 2).toUpperCase();
  const accountName = contact.accountId ? accounts.find((a) => a.id === contact.accountId)?.name ?? "—" : null;
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "—" : null);
  const save = (field: string) => (value: string) => updateContactField(contact.id, field, value);

  const notes = activities.filter((a) => a.type === "NOTE");
  const tasks = activities.filter((a) => a.type === "TASK");

  const anchor = { contactId: contact.id, accountId: contact.accountId ?? undefined };

  return (
    <div className="lg:flex lg:gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <Link href="/crm/contacts" className="hover:underline">Contacts</Link>
          <span>/</span>
          <span className="text-fg">{fullName}</span>
        </div>

        <div className="mb-4 flex items-center gap-2 border-b border-border">
          {TABS.map((t) => {
            const count = t === "Notes" ? notes.length : t === "Tasks" ? tasks.length : activities.length;
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
                  addActivity({ ...anchor, type: "NOTE", subject: text }).then((r) => {
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
                  addActivity({ ...anchor, type: "TASK", subject, dueDate }).then((r) => {
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
      </div>

      <aside className="mt-6 shrink-0 border-t border-border pt-6 lg:mt-0 lg:w-80 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-fg">{fullName || "—"}</div>
            <div className="mt-1 flex items-center gap-2 text-muted">
              {contact.phone && <a href={`tel:${contact.phone}`} title="Call" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="phone" className="h-4 w-4" /></a>}
              {contact.email && <a href={`mailto:${contact.email}`} title="Email" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="mail" className="h-4 w-4" /></a>}
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Details</p>
        <dl className="space-y-3">
          <Row label="First name"><InlineField value={contact.firstName} placeholder="First name" editable={editable} onSave={save("firstName")} /></Row>
          <Row label="Last name"><InlineField value={contact.lastName ?? ""} placeholder="Add last name…" editable={editable} onSave={save("lastName")} /></Row>
          <Row label="Job title"><InlineField value={contact.title ?? ""} placeholder="Add job title…" editable={editable} onSave={save("title")} /></Row>
          <Row label="Email"><InlineField value={contact.email ?? ""} placeholder="Add email…" kind="email" editable={editable} onSave={save("email")} /></Row>
          <Row label="Phone"><InlineField value={contact.phone ?? ""} placeholder="Add phone…" kind="tel" editable={editable} onSave={save("phone")} /></Row>
          <Row label="Account">
            <InlineField
              value={contact.accountId ?? ""}
              kind="select"
              placeholder="Link account…"
              editable={editable}
              options={[{ value: "", label: "— No account —" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              onSave={save("accountId")}
              render={() => (accountName ? <Link href={`/crm/accounts/${contact.accountId}`} className="text-brand-600 hover:underline">{accountName}</Link> : <>— No account —</>)}
            />
          </Row>
          <Row label="Owner">
            <InlineField
              value={contact.ownerId ?? ""}
              kind="select"
              placeholder="Assign owner…"
              editable={editable}
              options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
              onSave={save("ownerId")}
              render={(v) => <>{userName(v) ?? "Unassigned"}</>}
            />
          </Row>
          <Row label="Primary">
            <InlineField
              value={contact.isPrimary ? "true" : "false"}
              kind="select"
              editable={editable}
              options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
              onSave={save("isPrimary")}
              render={(v) => <>{v === "true" ? "Primary contact" : "No"}</>}
            />
          </Row>
          <Row label="Notes"><InlineField value={contact.notes ?? ""} placeholder="Add notes…" kind="textarea" editable={editable} onSave={save("notes")} /></Row>
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
