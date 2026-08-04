import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { monthLabel, MONTH_NAMES } from "@/lib/constants";
import { PageHeader, Stat, StatusBadge, Money } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function DashboardPage() {
  const { year, month } = currentPeriod();

  const entries = await prisma.paymentEntry.findMany({
    where: { periodYear: year, periodMonth: month },
    orderBy: { serviceName: "asc" },
  });

  const totalInr = entries.reduce((s, e) => s + e.amountInrPaise, 0);
  const paidInr = entries.reduce((s, e) => s + e.thisMonthPaidInrPaise, 0);
  const pending = entries.filter((e) => e.status === "PENDING");
  const overdue = entries.filter((e) => e.status === "OVERDUE");
  const outstandingInr = entries
    .filter((e) => e.status !== "PAID")
    .reduce((s, e) => s + e.amountInrPaise, 0);

  // Last 6 months of "paid" totals for the mini chart.
  const chart: { year: number; month: number; paid: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(year, month - 1 - i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    const rows = await prisma.paymentEntry.aggregate({
      where: { periodYear: y, periodMonth: m },
      _sum: { thisMonthPaidInrPaise: true },
    });
    chart.push({ year: y, month: m, paid: rows._sum.thisMonthPaidInrPaise ?? 0 });
  }
  const maxPaid = Math.max(1, ...chart.map((c) => c.paid));

  // Items needing attention across all months (overdue + unpaid with a due date).
  const attention = await prisma.paymentEntry.findMany({
    where: { status: { in: ["OVERDUE", "PENDING"] }, dueDate: { not: null } },
    orderBy: { dueDate: "asc" },
    take: 8,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Recurring payments overview — ${monthLabel(year, month)}`}
        action={
          <Link href={`/tracker?y=${year}&m=${month}`} className="btn-primary">
            Open this month
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Billed this month (INR)" value={formatMoneyCompact(totalInr, "INR")} href={`/tracker?y=${year}&m=${month}`} />
        <Stat label="Paid this month (INR)" value={formatMoneyCompact(paidInr, "INR")} tone="success" />
        <Stat label="Outstanding (INR)" value={formatMoneyCompact(outstandingInr, "INR")} tone={outstandingInr > 0 ? "warning" : "default"} />
        <Stat
          label="Overdue"
          value={String(overdue.length)}
          hint={pending.length ? `${pending.length} pending` : undefined}
          tone={overdue.length ? "danger" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Chart */}
        <div className="card p-5 lg:col-span-3">
          <p className="text-sm font-medium text-fg">Paid per month (INR)</p>
          <div className="mt-6 flex items-end justify-between gap-3" style={{ height: 160 }}>
            {chart.map((c) => (
              <div key={`${c.year}-${c.month}`} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end justify-center" style={{ height: 120 }}>
                  <div
                    className="w-8 rounded-t bg-brand-500"
                    style={{ height: `${Math.round((c.paid / maxPaid) * 120)}px` }}
                    title={formatMoney(c.paid, "INR")}
                  />
                </div>
                <span className="text-[11px] text-muted">{MONTH_NAMES[c.month - 1].slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Needs attention */}
        <div className="card p-5 lg:col-span-2">
          <p className="text-sm font-medium text-fg">Needs attention</p>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing outstanding. 🎉</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {attention.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/tracker?y=${e.periodYear}&m=${e.periodMonth}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{e.serviceName}</p>
                    <p className="text-xs text-muted">
                      {monthLabel(e.periodYear, e.periodMonth)}
                      {e.dueDate ? ` · due ${format(e.dueDate, "d MMM")}` : ""}
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={e.status} />
                    <span className="text-xs text-muted">
                      <Money minor={e.amountInrPaise} currency="INR" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
