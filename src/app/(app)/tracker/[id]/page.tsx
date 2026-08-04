import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EntryForm, type ServiceOption, type EntryInitial } from "@/components/EntryForm";
import { DocumentForm, DeleteDocButton } from "@/components/DocumentForm";
import { monthLabel } from "@/lib/constants";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string | undefined {
  if (!d) return undefined;
  return new Date(d).toISOString().slice(0, 10);
}

export default async function EditEntryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { y?: string; m?: string };
}) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/tracker");

  const entry = await prisma.paymentEntry.findUnique({
    where: { id: params.id },
    include: { documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!entry) notFound();

  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const options: ServiceOption[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    vendorType: s.vendorType,
    billingFrequency: s.billingFrequency,
    dueDayOfMonth: s.dueDayOfMonth,
    defaultInr: s.defaultInrPaise,
    defaultUsd: s.defaultUsdCents,
    defaultEur: s.defaultEurCents,
  }));

  const initial: EntryInitial = {
    id: entry.id,
    serviceId: entry.serviceId,
    serviceName: entry.serviceName,
    vendorType: entry.vendorType,
    billingFrequency: entry.billingFrequency,
    status: entry.status,
    dueDate: toDateInput(entry.dueDate),
    paymentMadeOn: toDateInput(entry.paymentMadeOn),
    amountInr: entry.amountInrPaise,
    amountUsd: entry.amountUsdCents,
    amountEur: entry.amountEurCents,
    thisMonthPaidInr: entry.thisMonthPaidInrPaise,
    notes: entry.notes ?? undefined,
  };

  return (
    <div>
      <PageHeader
        title={entry.serviceName}
        subtitle={`${monthLabel(entry.periodYear, entry.periodMonth)} · edit payment row`}
        action={
          <Link href={`/tracker?y=${entry.periodYear}&m=${entry.periodMonth}`} className="btn-secondary">
            Back to month
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EntryForm year={entry.periodYear} month={entry.periodMonth} services={options} initial={initial} />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <p className="text-sm font-medium text-fg">Documents</p>
            <p className="mt-0.5 text-xs text-muted">Invoices &amp; receipts for this payment.</p>
            {entry.documents.length === 0 ? (
              <p className="mt-3 text-sm text-faint">None attached yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {entry.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      {doc.kind === "LINK" ? (
                        <a href={doc.externalUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate text-sm text-brand-600 hover:underline">
                          🔗 {doc.title}
                        </a>
                      ) : (
                        <a href={`/api/documents/${doc.id}`} className="truncate text-sm text-brand-600 hover:underline">
                          📄 {doc.title}
                        </a>
                      )}
                      <p className="text-[11px] text-faint">
                        {doc.uploadedBy?.name ?? "—"} · {format(doc.createdAt, "d MMM yyyy")}
                      </p>
                    </div>
                    <DeleteDocButton id={doc.id} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <DocumentForm entryId={entry.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
