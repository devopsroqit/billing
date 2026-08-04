import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { toggleServiceActive } from "@/app/actions";
import {
  VENDOR_TYPE_LABELS,
  BILLING_FREQUENCY_LABELS,
  type VendorType,
  type BillingFrequency,
  type Currency,
} from "@/lib/constants";
import { PageHeader, StatusBadge, Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const user = await getSessionUser();
  const editable = user ? canEdit(user.role) : false;

  const services = await prisma.service.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="The recurring vendors you pay. Each month's rows are generated from these."
        action={editable ? <Link href="/services/new" className="btn-primary">New service</Link> : null}
      />

      {services.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No services yet.</p>
          {editable && <p className="mt-1 text-sm text-muted">Add GitHub, AWS, etc. to start generating monthly rows.</p>}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Service</th>
                <th className="th">Type</th>
                <th className="th">Frequency</th>
                <th className="th">Currency</th>
                <th className="th">Due day</th>
                <th className="th text-right">Default amount</th>
                <th className="th">Status</th>
                {editable && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => {
                const defMinor =
                  s.currency === "INR" ? s.defaultInrPaise : s.currency === "USD" ? s.defaultUsdCents : s.defaultEurCents;
                return (
                  <tr key={s.id} className="hover:bg-surface-2">
                    <td className="td font-medium text-fg">
                      {s.name}
                      {s.notes && <p className="text-xs font-normal text-faint line-clamp-1">{s.notes}</p>}
                    </td>
                    <td className="td">{VENDOR_TYPE_LABELS[s.vendorType as VendorType] ?? s.vendorType}</td>
                    <td className="td">{BILLING_FREQUENCY_LABELS[s.billingFrequency as BillingFrequency] ?? s.billingFrequency}</td>
                    <td className="td">{s.currency}</td>
                    <td className="td">{s.dueDayOfMonth ?? "—"}</td>
                    <td className="td text-right"><Money minor={defMinor} currency={s.currency as Currency} /></td>
                    <td className="td"><StatusBadge status={s.active ? "ACTIVE" : "INACTIVE"} label={s.active ? "Active" : "Inactive"} /></td>
                    {editable && (
                      <td className="td">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/services/${s.id}`} className="text-xs font-medium text-muted hover:underline">Edit</Link>
                          <form action={toggleServiceActive.bind(null, s.id)}>
                            <button className="text-xs font-medium text-brand-600 hover:underline">
                              {s.active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
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
