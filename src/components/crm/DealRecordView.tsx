"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui";
import { InlineField } from "@/components/crm/InlineField";
import { Feed, NoteComposer, TaskComposer, type ActivityItem } from "@/components/crm/ActivityPanel";
import { majorToMinor, minorToMajor, formatMoney } from "@/lib/money";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  COMMERCIAL_MODELS,
  COMMERCIAL_MODEL_LABELS,
  type DealStage,
  type CommercialModel,
  type Currency,
} from "@/lib/constants";
import {
  updateDealField,
  addActivity,
  toggleActivityDone,
  deleteActivity,
} from "@/app/crm-actions";

export type { ActivityItem };
type Option = { id: string; name: string };
type PersonItem = { id: string; name: string; title: string | null; isPrimary: boolean; email: string | null };
export type DealData = {
  id: string;
  title: string;
  stage: string;
  commercialModel: string | null;
  currency: string;
  amountMinor: number;
  arrMinor: number;
  assetsInScope: number | null;
  packsInScope: string | null;
  nextAction: string | null;
  companyId: string | null;
  ownerId: string | null;
  contractSignedDate: string | null; // yyyy-mm-dd
  firstInvoiceDate: string | null;
  firstPaymentDate: string | null;
  lossReason: string | null;
  notes: string | null;
};

const TABS = ["Overview", "Activity", "Notes", "Tasks", "People"] as const;
type Tab = (typeof TABS)[number];

const fmtDate = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : format(d, "d MMM yyyy");
};

export function DealRecordView({
  deal,
  companies,
  users,
  activities,
  people,
  nextDueTaskLabel,
  editable,
}: {
  deal: DealData;
  companies: Option[];
  users: Option[];
  activities: ActivityItem[];
  people: PersonItem[];
  nextDueTaskLabel: string | null;
  editable: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const router = useRouter();

  const currency = deal.currency as Currency;
  const initials = deal.title.trim().slice(0, 2).toUpperCase();
  const userName = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "—" : null);
  const companyName = deal.companyId ? companies.find((c) => c.id === deal.companyId)?.name ?? "—" : null;
  const save = (field: string) => (value: string) => updateDealField(deal.id, field, value);

  const notes = activities.filter((a) => a.type === "NOTE");
  const tasks = activities.filter((a) => a.type === "TASK");

  // Money fields edit in major units; render formats the minor-unit amount.
  const moneyValue = (minor: number) => (minor ? String(minorToMajor(minor)) : "");
  const moneyRender = (v: string) => formatMoney(v ? majorToMinor(Number(v)) : 0, currency);

  return (
    <div className="lg:flex lg:gap-6">
      {/* MAIN */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted">
          <Link href="/crm/deals" className="hover:underline">Deals</Link>
          <span>/</span>
          <span className="text-fg">{deal.title}</span>
        </div>

        <div className="mb-4 flex items-center gap-2 border-b border-border">
          {TABS.map((t) => {
            const count = t === "Notes" ? notes.length : t === "Tasks" ? tasks.length : t === "People" ? people.length : t === "Activity" ? activities.length : null;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {t} {count != null && <span className="text-xs text-faint">{count}</span>}
              </button>
            );
          })}
        </div>

        {tab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Highlight label="Deal stage"><StatusBadge status={deal.stage} label={DEAL_STAGE_LABELS[deal.stage as DealStage] ?? deal.stage} /></Highlight>
              <Highlight label="Deal value"><span className="text-lg font-semibold text-fg">{formatMoney(deal.amountMinor, currency)}</span></Highlight>
              <Highlight label="Deal owner">{userName(deal.ownerId) ?? "Unassigned"}</Highlight>
              <Highlight label="ARR value">{formatMoney(deal.arrMinor, currency)}</Highlight>
              <Highlight label="Commercial model">{deal.commercialModel ? COMMERCIAL_MODEL_LABELS[deal.commercialModel as CommercialModel] ?? deal.commercialModel : "—"}</Highlight>
              <Highlight label="Next due task">{nextDueTaskLabel ?? "No next due task"}</Highlight>
            </div>
            {deal.nextAction && (
              <div className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-faint">Next action</p>
                <p className="mt-1 text-sm text-fg">{deal.nextAction}</p>
              </div>
            )}
            {deal.lossReason && (
              <div className="card border-red-500/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Loss reason</p>
                <p className="mt-1 text-sm text-fg">{deal.lossReason}</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Recent activity</p>
              <Feed
                items={activities.slice(0, 6)}
                editable={editable}
                onToggle={(id) => toggleActivityDone(id).then(() => router.refresh())}
                onDelete={(id) => deleteActivity(id).then(() => router.refresh())}
              />
            </div>
          </div>
        )}

        {tab === "Activity" && (
          <div className="space-y-4">
            {editable && (
              <NoteComposer
                onAdd={(text) =>
                  addActivity({ dealId: deal.id, companyId: deal.companyId ?? undefined, type: "NOTE", subject: text }).then((r) => {
                    if (!r || !("error" in r) || !r.error) router.refresh();
                    return r;
                  })
                }
              />
            )}
            <Feed
              items={activities}
              editable={editable}
              onToggle={(id) => toggleActivityDone(id).then(() => router.refresh())}
              onDelete={(id) => deleteActivity(id).then(() => router.refresh())}
            />
          </div>
        )}

        {tab === "Notes" && (
          <div className="space-y-4">
            {editable && (
              <NoteComposer
                onAdd={(text) =>
                  addActivity({ dealId: deal.id, companyId: deal.companyId ?? undefined, type: "NOTE", subject: text }).then((r) => {
                    if (!r || !("error" in r) || !r.error) router.refresh();
                    return r;
                  })
                }
              />
            )}
            <Feed
              items={notes}
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
                  addActivity({ dealId: deal.id, companyId: deal.companyId ?? undefined, type: "TASK", subject, dueDate }).then((r) => {
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

        {tab === "People" && (
          <div className="space-y-3">
            {people.length === 0 ? (
              <p className="card p-4 text-sm text-muted">No associated people. Add contacts on the company record.</p>
            ) : (
              <div className="card divide-y divide-border">
                {people.map((p) => (
                  <Link key={p.id} href={`/crm/contacts/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2">
                    <span className="text-sm text-fg">
                      {p.name}
                      {p.isPrimary && <span className="ml-2 text-xs text-brand-600">Primary</span>}
                      {p.title && <span className="block text-xs text-faint">{p.title}</span>}
                    </span>
                    <span className="text-xs text-faint">{p.email ?? ""}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT RAIL */}
      <aside className="mt-6 shrink-0 border-t border-border pt-6 lg:mt-0 lg:w-80 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-fg">
              <InlineField value={deal.title} placeholder="Deal name" editable={editable} onSave={save("title")} />
            </div>
            <div className="mt-1">
              <StatusBadge status={deal.stage} label={DEAL_STAGE_LABELS[deal.stage as DealStage] ?? deal.stage} />
            </div>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Details</p>
        <dl className="space-y-3">
          <Row label="Stage">
            <InlineField
              value={deal.stage}
              kind="select"
              editable={editable}
              options={DEAL_STAGES.map((s) => ({ value: s, label: DEAL_STAGE_LABELS[s] }))}
              onSave={save("stage")}
              render={(v) => <StatusBadge status={v} label={DEAL_STAGE_LABELS[v as DealStage] ?? v} />}
            />
          </Row>
          <Row label="Company/Site">
            <InlineField
              value={deal.companyId ?? ""}
              kind="select"
              placeholder="Link company…"
              editable={editable}
              options={[{ value: "", label: "— No company —" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
              onSave={save("companyId")}
              render={() => (companyName ? <Link href={`/crm/companies/${deal.companyId}`} className="text-brand-600 hover:underline">{companyName}</Link> : <>— No company —</>)}
            />
          </Row>
          <Row label="Owner">
            <InlineField
              value={deal.ownerId ?? ""}
              kind="select"
              placeholder="Assign owner…"
              editable={editable}
              options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
              onSave={save("ownerId")}
              render={(v) => <>{userName(v) ?? "Unassigned"}</>}
            />
          </Row>
          <Row label="Commercial">
            <InlineField
              value={deal.commercialModel ?? ""}
              kind="select"
              placeholder="Add model…"
              editable={editable}
              options={[{ value: "", label: "—" }, ...COMMERCIAL_MODELS.map((m) => ({ value: m, label: COMMERCIAL_MODEL_LABELS[m] }))]}
              onSave={save("commercialModel")}
              render={(v) => <>{v ? COMMERCIAL_MODEL_LABELS[v as CommercialModel] ?? v : "—"}</>}
            />
          </Row>
          <Row label="Deal value">
            <InlineField value={moneyValue(deal.amountMinor)} placeholder="Add value…" editable={editable} onSave={save("amount")} render={moneyRender} />
          </Row>
          <Row label="ARR value">
            <InlineField value={moneyValue(deal.arrMinor)} placeholder="Add ARR…" editable={editable} onSave={save("arr")} render={moneyRender} />
          </Row>
          <Row label="Assets"><InlineField value={deal.assetsInScope != null ? String(deal.assetsInScope) : ""} placeholder="Add count…" editable={editable} onSave={save("assetsInScope")} /></Row>
          <Row label="Packs"><InlineField value={deal.packsInScope ?? ""} placeholder="Add packs…" editable={editable} onSave={save("packsInScope")} /></Row>
          <Row label="Next action"><InlineField value={deal.nextAction ?? ""} placeholder="Add next action…" editable={editable} onSave={save("nextAction")} /></Row>
          <Row label="Signed">
            <InlineField value={deal.contractSignedDate ?? ""} kind="date" placeholder="Add date…" editable={editable} onSave={save("contractSignedDate")} render={(v) => <>{v ? fmtDate(v) : "—"}</>} />
          </Row>
          <Row label="1st invoice">
            <InlineField value={deal.firstInvoiceDate ?? ""} kind="date" placeholder="Add date…" editable={editable} onSave={save("firstInvoiceDate")} render={(v) => <>{v ? fmtDate(v) : "—"}</>} />
          </Row>
          <Row label="1st payment">
            <InlineField value={deal.firstPaymentDate ?? ""} kind="date" placeholder="Add date…" editable={editable} onSave={save("firstPaymentDate")} render={(v) => <>{v ? fmtDate(v) : "—"}</>} />
          </Row>
          <Row label="Loss reason"><InlineField value={deal.lossReason ?? ""} placeholder="Add loss reason…" kind="textarea" editable={editable} onSave={save("lossReason")} /></Row>
          <Row label="Notes"><InlineField value={deal.notes ?? ""} placeholder="Add notes…" kind="textarea" editable={editable} onSave={save("notes")} /></Row>
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

function Highlight({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-faint">{label}</p>
      <div className="mt-1 text-sm text-fg">{children}</div>
    </div>
  );
}
