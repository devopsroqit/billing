import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoneyCompact } from "@/lib/money";
import { DEVICE_STATUS_LABELS, DEVICE_STATUSES, type DeviceStatus, type Currency } from "@/lib/constants";
import { PageHeader, Stat } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AssetsOverviewPage() {
  const [byStatus, spendByCurrency, totalDevices, supplierCount, recentPurchases] = await Promise.all([
    prisma.device.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.purchase.groupBy({ by: ["currency"], _sum: { amountMinor: true }, _count: { _all: true } }),
    prisma.device.count(),
    prisma.supplier.count(),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true }, take: 6 }),
  ]);

  const countFor = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const deployed = countFor("DEPLOYED");
  const inStock = countFor("IN_STOCK");
  const attention = countFor("FAULTY") + countFor("IN_REPAIR");
  const maxStatus = Math.max(1, ...byStatus.map((r) => r._count._all));

  return (
    <div>
      <PageHeader
        title="Assets overview"
        subtitle="Everything you've procured, at a glance."
        action={<Link href="/devices" className="btn-primary">View devices</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total devices" value={String(totalDevices)} href="/devices" />
        <Stat label="Deployed" value={String(deployed)} tone="success" />
        <Stat label="In stock" value={String(inStock)} />
        <Stat label="Faulty / in repair" value={String(attention)} tone={attention ? "danger" : "default"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Devices by status */}
        <div className="card p-5 lg:col-span-3">
          <p className="text-sm font-medium text-fg">Devices by status</p>
          {totalDevices === 0 ? (
            <p className="mt-3 text-sm text-muted">No devices yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {DEVICE_STATUSES.map((s) => {
                const n = countFor(s);
                return (
                  <div key={s} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-muted">{DEVICE_STATUS_LABELS[s as DeviceStatus]}</span>
                    <div className="h-4 flex-1 rounded bg-surface-2">
                      <div className="h-4 rounded bg-brand-500" style={{ width: `${Math.round((n / maxStatus) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-fg">{n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Spend */}
        <div className="card p-5 lg:col-span-2">
          <p className="text-sm font-medium text-fg">Procurement spend</p>
          <p className="mt-0.5 text-xs text-muted">{supplierCount} supplier{supplierCount === 1 ? "" : "s"}</p>
          {spendByCurrency.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No purchases recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {spendByCurrency.map((r) => (
                <li key={r.currency} className="flex items-center justify-between">
                  <span className="text-sm text-muted">{r.currency} · {r._count._all} purchase{r._count._all === 1 ? "" : "s"}</span>
                  <span className="text-sm font-semibold text-fg">
                    {formatMoneyCompact(r._sum.amountMinor ?? 0, r.currency as Currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent purchases */}
      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="text-sm font-medium text-fg">Recent purchases</p>
          <Link href="/purchases" className="text-xs font-medium text-brand-600 hover:underline">All purchases</Link>
        </div>
        {recentPurchases.length === 0 ? (
          <p className="p-4 text-sm text-faint">No purchases yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Date</th>
                <th className="th">Reference</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentPurchases.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className="td whitespace-nowrap">
                    <Link href={`/purchases/${p.id}`} className="text-brand-600 hover:underline">{format(p.purchaseDate, "d MMM yyyy")}</Link>
                  </td>
                  <td className="td">{p.reference || "—"}</td>
                  <td className="td">{p.supplier?.name || "—"}</td>
                  <td className="td text-right">{p.quantity}</td>
                  <td className="td text-right">{formatMoneyCompact(p.amountMinor, p.currency as Currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
