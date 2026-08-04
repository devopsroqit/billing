import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { totalsFor, listPeriods } from "@/lib/entries";
import { generateMonth, duplicatePreviousMonth } from "@/app/actions";
import { previousPeriod } from "@/lib/entries";
import { formatMoneyCompact } from "@/lib/money";
import {
  monthLabel,
  MONTH_NAMES,
  VENDOR_TYPE_LABELS,
  BILLING_FREQUENCY_LABELS,
  type VendorType,
  type BillingFrequency,
} from "@/lib/constants";
import { PageHeader, StatusBadge, Money } from "@/components/ui";
import { EntryActions } from "@/components/EntryActions";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const cur = currentPeriod();
  const year = Number(searchParams.y) || cur.year;
  const month = Number(searchParams.m) || cur.month;

  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const entries = await prisma.paymentEntry.findMany({
    where: { periodYear: year, periodMonth: month },
    orderBy: [{ status: "asc" }, { serviceName: "asc" }],
    include: { documents: true },
  });

  const totals = totalsFor(entries);

  // Build the month tab strip: every period that has data + the current one.
  const periods = await listPeriods();
  const key = (y: number, m: number) => `${y}-${m}`;
  const set = new Map(periods.map((p) => [key(p.year, p.month), p]));
  set.set(key(cur.year, cur.month), cur);
  set.set(key(year, month), { year, month });
  const tabs = Array.from(set.values()).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const prevP = previousPeriod(year, month);
  const prevLabel = `${MONTH_NAMES[prevP.month - 1].slice(0, 3)} ${prevP.year}`;

  return (
    <div>
      <PageHeader
        title="Monthly Tracker"
        subtitle={monthLabel(year, month)}
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/export/tracker?y=${year}&m=${month}`}
              className="btn-secondary"
              title={`Download ${monthLabel(year, month)} as an Excel file`}
            >
              ⬇ Export Excel
            </a>
            {editable && (
              <>
                <form action={duplicatePreviousMonth}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <button className="btn-secondary" title={`Copy every row from ${prevLabel} into this month (amounts & notes kept, status reset to pending)`}>
                    Duplicate {prevLabel}
                  </button>
                </form>
                <form action={generateMonth}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <button className="btn-secondary" title="Create rows for every active service that doesn't have one yet">
                    Generate month
                  </button>
                </form>
                <Link href={`/tracker/new?y=${year}&m=${month}`} className="btn-primary">
                  Add row
                </Link>
              </>
            )}
          </div>
        }
      />

      {/* Month tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/tracker?y=${prev.getFullYear()}&m=${prev.getMonth() + 1}`}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2"
        >
          ‹ Prev
        </Link>
        {tabs.map((t) => {
          const active = t.year === year && t.month === month;
          return (
            <Link
              key={key(t.year, t.month)}
              href={`/tracker?y=${t.year}&m=${t.month}`}
              className={`rounded-lg px-3 py-1 text-sm font-medium ${
                active ? "bg-brand-600 text-white" : "bg-surface text-muted ring-1 ring-inset ring-border hover:bg-surface-2"
              }`}
            >
              {MONTH_NAMES[t.month - 1].slice(0, 3)} {t.year}
            </Link>
          );
        })}
        <Link
          href={`/tracker?y=${next.getFullYear()}&m=${next.getMonth() + 1}`}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-surface-2"
        >
          Next ›
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No rows for {monthLabel(year, month)} yet.</p>
          {editable ? (
            <>
              <p className="mt-1 text-sm text-muted">
                Start this month by copying last month, generating from your services, or adding rows by hand.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <form action={duplicatePreviousMonth}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <button className="btn-primary" title={`Copy every row from ${prevLabel} into this month`}>
                    Duplicate {prevLabel}
                  </button>
                </form>
                <form action={generateMonth}>
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="month" value={month} />
                  <button className="btn-secondary">Generate from services</button>
                </form>
                <Link href={`/tracker/new?y=${year}&m=${month}`} className="btn-secondary">Add row</Link>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Ask an editor to add this month's payments.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Service</th>
                <th className="th">Type</th>
                <th className="th">Frequency</th>
                <th className="th">Due</th>
                <th className="th">Paid on</th>
                <th className="th">Status</th>
                <th className="th text-right">INR</th>
                <th className="th text-right">USD</th>
                <th className="th text-right">EUR</th>
                <th className="th text-right">Paid (INR)</th>
                <th className="th">Docs</th>
                <th className="th">Notes</th>
                {editable && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-surface-2">
                  <td className="td font-medium text-fg">{e.serviceName}</td>
                  <td className="td">{VENDOR_TYPE_LABELS[e.vendorType as VendorType] ?? e.vendorType}</td>
                  <td className="td">{BILLING_FREQUENCY_LABELS[e.billingFrequency as BillingFrequency] ?? e.billingFrequency}</td>
                  <td className="td">{e.dueDate ? format(e.dueDate, "d-MMM-yy") : "—"}</td>
                  <td className="td">{e.paymentMadeOn ? format(e.paymentMadeOn, "d-MMM-yy") : "—"}</td>
                  <td className="td"><StatusBadge status={e.status} /></td>
                  <td className="td text-right"><Money minor={e.amountInrPaise} currency="INR" /></td>
                  <td className="td text-right"><Money minor={e.amountUsdCents} currency="USD" /></td>
                  <td className="td text-right"><Money minor={e.amountEurCents} currency="EUR" /></td>
                  <td className="td text-right font-medium">
                    <Money minor={e.thisMonthPaidInrPaise} currency="INR" />
                  </td>
                  <td className="td">
                    {e.documents.length === 0 ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {e.documents.map((doc) =>
                          doc.kind === "LINK" ? (
                            <a key={doc.id} href={doc.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline" title={doc.title}>
                              🔗 {doc.title.length > 18 ? doc.title.slice(0, 18) + "…" : doc.title}
                            </a>
                          ) : (
                            <a key={doc.id} href={`/api/documents/${doc.id}`} className="text-xs text-brand-600 hover:underline" title={doc.title}>
                              📄 {doc.title.length > 18 ? doc.title.slice(0, 18) + "…" : doc.title}
                            </a>
                          ),
                        )}
                      </div>
                    )}
                  </td>
                  <td className="td max-w-[16rem]">
                    <span className="line-clamp-2 text-xs text-muted">{e.notes}</span>
                  </td>
                  {editable && (
                    <td className="td">
                      <EntryActions id={e.id} status={e.status} editHref={`/tracker/${e.id}?y=${year}&m=${month}`} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-2">
              <tr className="font-semibold text-fg">
                <td className="td" colSpan={6}>Total</td>
                <td className="td text-right">{formatMoneyCompact(totals.inr, "INR")}</td>
                <td className="td text-right">{formatMoneyCompact(totals.usd, "USD")}</td>
                <td className="td text-right">{formatMoneyCompact(totals.eur, "EUR")}</td>
                <td className="td text-right">{formatMoneyCompact(totals.paid, "INR")}</td>
                <td className="td" colSpan={editable ? 3 : 2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
