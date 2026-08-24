import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  type DealStage,
  type Currency,
} from "@/lib/constants";
import { PageHeader, StatusBadge, Stat, EmptyState } from "@/components/ui";
import { DealBoard, type BoardDeal } from "@/components/crm/DealBoard";
import { Pager } from "@/components/Pager";

const PAGE_SIZE = 50;
const BOARD_CAP = 500;

// Stages at/after a signed contract count as "won"; a deal with a loss reason
// counts as lost. Used for the KPI strip.
const WON_STAGES = new Set(["WON_CONTRACTED", "DEPLOYMENT_STARTED", "BILLING_ACTIVE", "CASH_RECEIVED"]);

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: { q?: string; stage?: string; view?: string; page?: string };
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  // Board is the default; the table stays available via the List toggle.
  const view = searchParams.view === "list" ? "list" : "board";
  const q = (searchParams.q ?? "").trim();
  const stage = searchParams.stage ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  // Server-side search matches title or company name — mirrors what the board
  // and list both need. The stage filter only applies to the list view (the
  // board renders every stage as a column, so stage would filter columns out).
  const whereBase: Record<string, unknown> = {};
  if (q) {
    whereBase.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { is: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const whereList = { ...whereBase, ...(stage ? { stage } : {}) };

  // Board fetches the whole (matching) pipeline up to a hard safety cap; list
  // paginates. `totalList` is used by the pager on the list view.
  const [deals, totalList] = await Promise.all([
    prisma.deal.findMany({
      where: view === "list" ? whereList : whereBase,
      orderBy: view === "list" ? [{ createdAt: "desc" }] : { createdAt: "desc" },
      skip: view === "list" ? (page - 1) * PAGE_SIZE : 0,
      take: view === "list" ? PAGE_SIZE : BOARD_CAP,
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
    }),
    view === "list" ? prisma.deal.count({ where: whereList }) : Promise.resolve(0),
  ]);

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  // KPIs reflect the WHOLE pipeline, independent of the search/stage filter, so
  // the headline numbers stay stable as you filter the board/list below.
  const [kpiDeals, overdueTaskCount, paymentAgg] = await Promise.all([
    prisma.deal.findMany({ select: { stage: true, amountMinor: true, arrMinor: true, lossReason: true, active: true } }),
    prisma.task.count({ where: { dealId: { not: null }, status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: new Date() } } }),
    prisma.dealPayment.aggregate({ _sum: { amountMinor: true }, _count: true }),
  ]);
  const cashReceivedMinor = paymentAgg._sum.amountMinor ?? 0;
  const paymentCount = paymentAgg._count;
  let openValueMinor = 0, openDeals = 0, wonValueMinor = 0, wonArrMinor = 0, wonDeals = 0, lostDeals = 0;
  for (const d of kpiDeals) {
    const lost = !!d.lossReason?.trim();
    const won = WON_STAGES.has(d.stage) && !lost;
    if (lost) lostDeals++;
    else if (won) { wonDeals++; wonValueMinor += d.amountMinor; wonArrMinor += d.arrMinor; }
    else if (d.active) { openDeals++; openValueMinor += d.amountMinor; }
  }
  const decided = wonDeals + lostDeals;
  const winRate = decided > 0 ? Math.round((wonDeals / decided) * 100) : null;

  // Search is now done server-side — `deals` is already filtered.
  const rows = deals;

  // Total deal value on the visible page. Deals share the app's primary
  // currency (INR) in practice; we sum the minor units and format as INR.
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
            <a
              href={`/api/export/deals${new URLSearchParams({ ...(q && { q }), ...(stage && { stage }) }).toString() ? `?${new URLSearchParams({ ...(q && { q }), ...(stage && { stage }) }).toString()}` : ""}`}
              className="btn-secondary"
              title="Download the filtered pipeline as Excel"
            >
              ⬇ Export Excel
            </a>
            {editable && <Link href="/crm/deals/new" className="btn-primary">New Deal</Link>}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <Stat label="Open pipeline" value={formatMoneyCompact(openValueMinor, "INR")} hint={`${openDeals} open deal${openDeals === 1 ? "" : "s"}`} />
        <Stat label="Open deals" value={String(openDeals)} />
        <Stat label="Won value" value={formatMoneyCompact(wonValueMinor, "INR")} tone="success" hint={`${wonDeals} won`} />
        <Stat
          label="Win rate"
          value={winRate === null ? "—" : `${winRate}%`}
          tone={winRate !== null && winRate >= 50 ? "success" : "default"}
          hint={winRate === null ? "no closed deals yet" : `${wonDeals} won · ${lostDeals} lost`}
        />
        <Stat label="ARR (won)" value={formatMoneyCompact(wonArrMinor, "INR")} tone="success" />
        <Stat label="Cash received" value={formatMoneyCompact(cashReceivedMinor, "INR")} tone="success" hint={`${paymentCount} payment${paymentCount === 1 ? "" : "s"}`} />
        <Stat
          label="Overdue tasks"
          value={String(overdueTaskCount)}
          tone={overdueTaskCount > 0 ? "danger" : "default"}
          href="/crm/tasks"
        />
      </div>

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
          <EmptyState
            icon="🔍"
            title={`No deals match “${q}”`}
            hint="Try clearing the search or switching to List view."
            action={<Link href={qs({ q: "" })} className="btn-secondary">Clear search</Link>}
          />
        ) : (
          <DealBoard deals={boardDeals} editable={editable} />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          icon="💼"
          title="No deals found"
          hint={q || stage ? "Try clearing the filters — you may be filtered to an empty stage." : "Track your sales pipeline end-to-end, from lead to cash received."}
          action={
            (q || stage)
              ? <Link href={qs({ q: "", stage: "" })} className="btn-secondary">Clear filters</Link>
              : editable ? <Link href="/crm/deals/new" className="btn-primary">Create your first deal</Link> : null
          }
        />
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
                    <td className="td num text-right">{d.amountMinor ? formatMoney(d.amountMinor, d.currency as Currency) : "—"}</td>
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
                <td className="td text-sm font-medium text-muted">{rows.length} on this page</td>
                <td className="td" />
                <td className="td" />
                <td className="td num text-right text-sm font-semibold text-fg">{formatMoney(totalMinor, "INR")} page sum</td>
                <td className="td" />
                <td className="td" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {view === "list" && (
        <Pager
          total={totalList}
          page={page}
          pageSize={PAGE_SIZE}
          basePath="/crm/deals"
          params={{ view, q, stage }}
        />
      )}
    </div>
  );
}
