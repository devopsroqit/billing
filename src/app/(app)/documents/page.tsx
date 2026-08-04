import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabel } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; source?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const source = (searchParams.source ?? "").trim(); // payments | purchases | devices

  const where: Record<string, unknown> = {};
  if (source === "payments") where.entryId = { not: null };
  else if (source === "purchases") where.purchaseId = { not: null };
  else if (source === "devices") where.deviceId = { not: null };

  const docs = await prisma.document.findMany({
    where,
    include: {
      entry: true,
      purchase: { include: { supplier: true } },
      device: true,
      uploadedBy: true,
    },
    orderBy: { createdAt: "desc" },
    take: 800,
  });

  const ql = q.toLowerCase();
  const filtered = q
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(ql) ||
          (d.entry?.serviceName ?? "").toLowerCase().includes(ql) ||
          (d.purchase?.reference ?? "").toLowerCase().includes(ql) ||
          (d.device?.serialNo ?? "").toLowerCase().includes(ql) ||
          (d.device?.category ?? "").toLowerCase().includes(ql),
      )
    : docs;

  return (
    <div>
      <PageHeader title="Documents" subtitle="Every uploaded file — invoices, receipts, warranty cards — in one searchable place." />

      {/* Filter bar */}
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-[12rem] flex-1">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Title, service, PO no., serial…" />
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" name="source" defaultValue={source}>
            <option value="">All sources</option>
            <option value="payments">Payments</option>
            <option value="purchases">Purchases</option>
            <option value="devices">Devices</option>
          </select>
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {(q || source) && <Link href="/documents" className="btn-secondary">Clear</Link>}
      </form>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No documents found.</p>
          <p className="mt-1 text-sm text-muted">Attach files from a payment row, a purchase, or a device.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Document</th>
                <th className="th">Attached to</th>
                <th className="th">Type</th>
                <th className="th">Added by</th>
                <th className="th">Added</th>
                <th className="th text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((doc) => {
                let owner: React.ReactNode = "—";
                if (doc.entry) {
                  owner = (
                    <Link href={`/tracker/${doc.entryId}?y=${doc.entry.periodYear}&m=${doc.entry.periodMonth}`} className="text-brand-600 hover:underline">
                      Payment · {doc.entry.serviceName} ({monthLabel(doc.entry.periodYear, doc.entry.periodMonth)})
                    </Link>
                  );
                } else if (doc.purchase) {
                  owner = (
                    <Link href={`/purchases/${doc.purchaseId}`} className="text-brand-600 hover:underline">
                      Purchase · {doc.purchase.reference || format(doc.purchase.purchaseDate, "d MMM yyyy")}
                      {doc.purchase.supplier ? ` · ${doc.purchase.supplier.name}` : ""}
                    </Link>
                  );
                } else if (doc.device) {
                  owner = (
                    <Link href={`/devices/${doc.deviceId}`} className="text-brand-600 hover:underline">
                      Device · {doc.device.category}{doc.device.serialNo ? ` (${doc.device.serialNo})` : ""}
                    </Link>
                  );
                }
                return (
                  <tr key={doc.id} className="hover:bg-surface-2">
                    <td className="td font-medium text-fg">
                      {doc.kind === "LINK" ? "🔗 " : "📄 "}{doc.title}
                      {doc.sizeBytes ? <span className="ml-1 text-xs text-faint">({fmtSize(doc.sizeBytes)})</span> : null}
                    </td>
                    <td className="td">{owner}</td>
                    <td className="td">{doc.kind === "LINK" ? "Link" : "File"}</td>
                    <td className="td">{doc.uploadedBy?.name ?? "—"}</td>
                    <td className="td">{format(doc.createdAt, "d MMM yyyy")}</td>
                    <td className="td text-right">
                      {doc.kind === "LINK" ? (
                        <a href={doc.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">Open ↗</a>
                      ) : (
                        <a href={`/api/documents/${doc.id}`} className="text-sm font-medium text-brand-600 hover:underline">Open</a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
