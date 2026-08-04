import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DeviceForm } from "@/components/DeviceForm";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NewDevicePage({
  searchParams,
}: {
  searchParams: { purchaseId?: string; supplierId?: string };
}) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/devices");

  const [suppliers, purchases] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchase.findMany({ orderBy: { purchaseDate: "desc" }, include: { supplier: true }, take: 200 }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add device" subtitle="Register an individual asset" />
      <DeviceForm
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        purchases={purchases.map((p) => ({
          id: p.id,
          label: `${p.reference || format(p.purchaseDate, "d MMM yyyy")}${p.supplier ? ` · ${p.supplier.name}` : ""}`,
        }))}
        defaultPurchaseId={searchParams.purchaseId}
        defaultSupplierId={searchParams.supplierId}
      />
    </div>
  );
}
