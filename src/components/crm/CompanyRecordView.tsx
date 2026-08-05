"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/ui";
import { InlineField } from "@/components/crm/InlineField";
import { ActivityAuditFeed, type ActivityAuditItem } from "@/components/crm/ActivityAuditFeed";
import { NotePanel, type NoteItem } from "@/components/crm/NotePanel";
import { TaskPanel, type TaskItem } from "@/components/crm/TaskPanel";
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  COMPANY_SOURCES,
  COMPANY_SOURCE_LABELS,
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  type RelationshipType,
  type CompanySource,
  type CompanySize,
} from "@/lib/constants";
import { updateCompanyField } from "@/app/crm-actions";

type ContactItem = { id: string; name: string; title: string | null; isPrimary: boolean; email: string | null; phone: string | null };
type DealItem = { id: string; title: string; stage: string; stageLabel: string; amountLabel: string };
type UserOpt = { id: string; name: string };
export type CompanyData = {
  id: string;
  name: string;
  relationshipType: string;
  source: string | null;
  size: string | null;
  domains: string | null;
  categories: string | null;
  primaryLocation: string | null;
  teamSize: number | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  ownerId: string | null;
};

const TABS = ["Activity", "Notes", "Tasks", "Contacts", "Deals"] as const;
type Tab = (typeof TABS)[number];

// First domain → an https URL (for the website affordance).
function firstDomainUrl(domains: string | null): string | null {
  const first = (domains ?? "").split(",")[0]?.trim();
  if (!first) return null;
  return /^https?:\/\//i.test(first) ? first : `https://${first}`;
}

// Split comma-separated tags into a clean list.
function tags(value: string | null): string[] {
  return (value ?? "").split(",").map((t) => t.trim()).filter(Boolean);
}

export function CompanyRecordView({
  company,
  users,
  auditItems,
  noteItems,
  taskItems,
  contacts,
  deals,
  editable,
}: {
  company: CompanyData;
  users: UserOpt[];
  auditItems: ActivityAuditItem[];
  noteItems: NoteItem[];
  taskItems: TaskItem[];
  contacts: ContactItem[];
  deals: DealItem[];
  editable: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Activity");

  const initials = company.name.trim().slice(0, 2).toUpperCase();
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "—" : null);
  const save = (field: string) => (value: string) => updateCompanyField(company.id, field, value);
  const website = firstDomainUrl(company.domains);

  return (
    <div className="lg:flex lg:gap-6">
      {/* MAIN — activity / tabs */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <Link href="/crm/companies" className="hover:underline">Companies</Link>
          <span>/</span>
          <span className="text-fg">{company.name}</span>
        </div>

        <div className="mb-4 flex items-center gap-2 border-b border-border">
          {TABS.map((t) => {
            const count = t === "Notes" ? noteItems.length : t === "Tasks" ? taskItems.length : t === "Contacts" ? contacts.length : t === "Deals" ? deals.length : auditItems.length;
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

        {tab === "Activity" && <ActivityAuditFeed items={auditItems} editable={editable} />}

        {tab === "Notes" && <NotePanel notes={noteItems} anchor={{ companyId: company.id }} editable={editable} />}

        {tab === "Tasks" && (
          <TaskPanel tasks={taskItems} users={users} anchor={{ companyId: company.id }} editable={editable} />
        )}

        {tab === "Contacts" && (
          <div className="space-y-3">
            {editable && (
              <Link href={`/crm/contacts/new?companyId=${company.id}`} className="btn-primary inline-flex">＋ Add contact</Link>
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
            {editable && (
              <Link href={`/crm/deals/new?companyId=${company.id}`} className="btn-primary inline-flex">＋ Add deal</Link>
            )}
            {deals.length === 0 ? (
              <p className="card p-4 text-sm text-muted">No deals yet.</p>
            ) : (
              <div className="card divide-y divide-border">
                {deals.map((d) => (
                  <Link key={d.id} href={`/crm/deals/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                    <span className="text-sm text-fg">{d.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-muted">{d.amountLabel}</span>
                      <StatusBadge status={d.stage} label={d.stageLabel} />
                    </span>
                  </Link>
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
              <InlineField value={company.name} placeholder="Company name" editable={editable} onSave={save("name")} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted">
              {company.phone && <a href={`tel:${company.phone}`} title="Call" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="phone" className="h-4 w-4" /></a>}
              {company.email && <a href={`mailto:${company.email}`} title="Email" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="mail" className="h-4 w-4" /></a>}
              {website && <a href={website} target="_blank" rel="noreferrer" title="Website" className="rounded p-1 hover:bg-surface-2 hover:text-brand-600"><Icon name="globe" className="h-4 w-4" /></a>}
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Details</p>
        <dl className="space-y-3">
          <Row label="Relationship">
            <InlineField
              value={company.relationshipType}
              kind="select"
              editable={editable}
              options={RELATIONSHIP_TYPES.map((t) => ({ value: t, label: RELATIONSHIP_TYPE_LABELS[t] }))}
              onSave={save("relationshipType")}
              render={(v) => <StatusBadge status={v} label={RELATIONSHIP_TYPE_LABELS[v as RelationshipType] ?? v} />}
            />
          </Row>
          <Row label="Owner">
            <InlineField
              value={company.ownerId ?? ""}
              kind="select"
              placeholder="Assign owner…"
              editable={editable}
              options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
              onSave={save("ownerId")}
              render={(v) => <>{userName(v) ?? "Unassigned"}</>}
            />
          </Row>
          <Row label="Source">
            <InlineField
              value={company.source ?? ""}
              kind="select"
              placeholder="Add source…"
              editable={editable}
              options={[{ value: "", label: "—" }, ...COMPANY_SOURCES.map((s) => ({ value: s, label: COMPANY_SOURCE_LABELS[s] }))]}
              onSave={save("source")}
              render={(v) => <>{v ? COMPANY_SOURCE_LABELS[v as CompanySource] ?? v : "—"}</>}
            />
          </Row>
          <Row label="Size">
            <InlineField
              value={company.size ?? ""}
              kind="select"
              placeholder="Add size…"
              editable={editable}
              options={[{ value: "", label: "—" }, ...COMPANY_SIZES.map((s) => ({ value: s, label: COMPANY_SIZE_LABELS[s] }))]}
              onSave={save("size")}
              render={(v) => <>{v ? COMPANY_SIZE_LABELS[v as CompanySize] ?? v : "—"}</>}
            />
          </Row>
          <Row label="Team size"><InlineField value={company.teamSize != null ? String(company.teamSize) : ""} placeholder="Add headcount…" editable={editable} onSave={save("teamSize")} /></Row>
          <Row label="Domains">
            <InlineField
              value={company.domains ?? ""}
              placeholder="Add domains…"
              editable={editable}
              onSave={save("domains")}
              render={(v) => (
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {tags(v).map((d) => (
                    <a key={d} href={/^https?:\/\//i.test(d) ? d : `https://${d}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{d}</a>
                  ))}
                </span>
              )}
            />
          </Row>
          <Row label="Categories">
            <InlineField
              value={company.categories ?? ""}
              placeholder="Add categories…"
              editable={editable}
              onSave={save("categories")}
              render={(v) => (
                <span className="flex flex-wrap gap-1">
                  {tags(v).map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{t}</span>
                  ))}
                </span>
              )}
            />
          </Row>
          <Row label="Location"><InlineField value={company.primaryLocation ?? ""} placeholder="Add location…" editable={editable} onSave={save("primaryLocation")} /></Row>
          <Row label="Email"><InlineField value={company.email ?? ""} placeholder="Add email…" kind="email" editable={editable} onSave={save("email")} /></Row>
          <Row label="Phone"><InlineField value={company.phone ?? ""} placeholder="Add phone…" kind="tel" editable={editable} onSave={save("phone")} /></Row>
          <Row label="GSTIN"><InlineField value={company.gstin ?? ""} placeholder="Add GSTIN…" editable={editable} onSave={save("gstin")} /></Row>
          <Row label="Description"><InlineField value={company.description ?? ""} placeholder="Add description…" kind="textarea" editable={editable} onSave={save("description")} /></Row>
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
