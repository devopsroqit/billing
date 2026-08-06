import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  type DealStage,
  type Currency,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DealBoard, type BoardDeal } from "@/components/crm/DealBoard";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; view?: string };
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  // Board is the default; the table stays available via the List toggle.
  const view = searchParams.view === "list" ? "list" : "board";
  const q = (searchParams.q ?? "").trim();
  const stage = searchParams.stage ?? "";

  const deals = await prisma.deal.findMany({
    // The board always shows every stage as a column, so it ignores the stage
    // filter; the list honours it.
    where: view === "list" && stage ? { stage } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true } },
      // The earliest open task on the deal → the "Next due task" column / card line.
      tasks: {
        where: { status: { notIn: ["DONE", "CANCELLED"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { title: true, dueAt: true },
      },
    },
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const rows = q
    ? deals.filter((d) =>
        [d.title, d.company?.name].filter(Boolean).some((v) => v!.toLowerCase().includes(q.toLowerCase())),
      )
    : deals;

  // Total deal value. Deals share the app's primary currency (INR) in practice;
  // we sum the minor units and format as INR for the footer.
  const totalMinor = rows.reduce((sum, d) => sum + d.amountMinor, 0);

  const nextTaskLabel = (d: (typeof rows)[number]): string | null => {
    const t = d.tasks[0];
    if (!t) return null;
    return `${t.title}${t.dueAt ? ` · due ${format(t.dueAt, "d MMM yyyy")}` : ""}`;
  };

  const boardDeals: BoardDeal[] = rows.map((d) => ({
    id: d.id,
    title: d.title,
    stage: d.stage,
    company: d.company?.name ?? null,
    owner: d.ownerId ? userName.get(d.ownerId) ?? null : null,
    amountMinor: d.amountMinor,
    valueLabel: d.amountMinor ? formatMoney(d.amountMinor, d.currency as Currency) : "",
    nextTaskLabel: nextTaskLabel(d),
    active: d.active,
    projectCompleted: !!d.projectCompletedAt,
  }));

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (stage) p.set("stage", stage);
    for (const [k, v] of Object.entries(over)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return s ? `/crm/deals?${s}` : "/crm/deals";
  };

  const toggle = (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <Link
        href={qs({ view: "board" })}
        className={`px-3 py-1.5 text-sm font-medium ${view === "board" ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-fg"}`}
      >
        Board
      </Link>
      <Link
        href={qs({ view: "list" })}
        className={`border-l border-border px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-fg"}`}
      >
        List
      </Link>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle="Your sales pipeline, from lead to cash received."
        action={
          <div className="flex items-center gap-3">
            {toggle}
            {editable && <Link href="/crm/deals/new" className="btn-primary">New Deal</Link>}
          </div>
        }
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <input type="hidden" name="view" value={view} />
        <div>
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Deal or company…" />
        </div>
        {view === "list" && (
          <div>
            <label className="label">Stage</label>
            <select className="input" name="stage" defaultValue={stage}>
              <option value="">All stages</option>
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>{DEAL_STAGE_LABELS[s as DealStage]}</option>
              ))}
            </select>
          </div>
        )}
        <button className="btn-primary" type="submit">Filter</button>
        {(q || stage) && <Link href={qs({ q: "", stage: "" })} className="btn-secondary">Clear</Link>}
      </form>

      {view === "board" ? (
        rows.length === 0 && q ? (
          <div className="card p-10 text-center">
            <p className="text-sm font-medium text-fg">No deals match “{q}”.</p>
            <p className="mt-1 text-sm text-muted">Try clearing the search.</p>
          </div>
        ) : (
          <DealBoard deals={boardDeals} editable={editable} />
        )
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No deals found</p>
          <p className="mt-1 text-sm text-muted">{q || stage ? "Try clearing the filters." : "Create your first deal to get started."}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Deal</th>
                <th className="th">Deal stage</th>
                <th className="th">Deal owner</th>
                <th className="th text-right">Deal value</th>
                <th className="th">Next due task</th>
                <th className="th">Created by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => {
                const task = d.tasks[0];
                return (
                  <tr key={d.id} className="hover:bg-surface-2">
                    <td className="td font-medium text-fg">
                      <Link href={`/crm/deals/${d.id}`} className="hover:underline">{d.title}</Link>
                      {!d.active && <span className="ml-2 text-xs text-faint">· Inactive</span>}
                      {d.projectCompletedAt && <span className="ml-2 text-xs text-emerald-600">· Completed</span>}
                      {d.company && <span className="block text-xs text-faint">{d.company.name}</span>}
                    </td>
                    <td className="td"><StatusBadge status={d.stage} label={DEAL_STAGE_LABELS[d.stage as DealStage] ?? d.stage} /></td>
                    <td className="td text-muted">{d.ownerId ? userName.get(d.ownerId) ?? "—" : "—"}</td>
                    <td className="td text-right">{d.amountMinor ? formatMoney(d.amountMinor, d.currency as Currency) : "—"}</td>
                    <td className="td text-muted">
                      {task ? (
                        <>
                          {task.title}
                          {task.dueAt && <span className="block text-xs text-faint">Due {format(task.dueAt, "d MMM yyyy")}</span>}
                        </>
                      ) : "—"}
                    </td>
                    <td className="td text-muted">{d.createdById ? userName.get(d.createdById) ?? "—" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2">
              <tr>
                <td className="td text-sm font-medium text-muted">{rows.length} count</td>
                <td className="td" />
                <td className="td" />
                <td className="td text-right text-sm font-semibold text-fg">{formatMoney(totalMinor, "INR")} sum</td>
                <td className="td" />
                <td className="td" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
