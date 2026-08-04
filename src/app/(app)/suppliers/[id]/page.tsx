import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { deleteSupplier } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";
import { DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/suppliers");

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
    include: { _count: { select: { purchases: true, devices: true } } },
  });
  if (!supplier) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${supplier.name}`} subtitle="Supplier details" />
      <SupplierForm supplier={supplier} />

      <div className="mt-6 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <div>
          <p className="text-sm font-medium text-fg">Delete this supplier</p>
          <p className="text-xs text-muted">
            Its {supplier._count.purchases} purchase(s) and {supplier._count.devices} device(s) are kept, but will no longer be linked to this supplier.
          </p>
        </div>
        <DeleteButton
          action={deleteSupplier.bind(null, supplier.id)}
          label="Delete supplier"
          confirmText={`Delete supplier “${supplier.name}”? This can't be undone.`}
        />
      </div>
    </div>
  );
}
