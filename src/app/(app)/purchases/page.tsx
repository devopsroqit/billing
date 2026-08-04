import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { formatMoneyCompact } from "@/lib/money";
import type { Currency } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const purchases = await prisma.purchase.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { supplier: true, _count: { select: { devices: true, documents: true } } },
    take: 500,
  });

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Procurement records — what you bought, from whom, and for how much."
        action={editable ? <Link href="/purchases/new" className="btn-primary">New purchase</Link> : null}
      />

      {purchases.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No purchases yet.</p>
          {editable && <p className="mt-1 text-sm text-muted">Record your first device procurement.</p>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Date</th>
                <th className="th">Reference</th>
                <th className="th">Supplier</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Amount</th>
                <th className="th text-right">Devices</th>
                <th className="th text-right">Docs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className="td whitespace-nowrap">
                    <Link href={`/purchases/${p.id}`} className="font-medium text-brand-600 hover:underline">
                      {format(p.purchaseDate, "d MMM yyyy")}
                    </Link>
                  </td>
                  <td className="td">{p.reference || "—"}</td>
                  <td className="td">{p.supplier?.name || "—"}</td>
                  <td className="td text-right">{p.quantity}</td>
                  <td className="td text-right">{formatMoneyCompact(p.amountMinor, p.currency as Currency)}</td>
                  <td className="td text-right">{p._count.devices}</td>
                  <td className="td text-right">{p._count.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
