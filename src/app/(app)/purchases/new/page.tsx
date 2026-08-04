import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "@/components/PurchaseForm";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage({ searchParams }: { searchParams: { supplierId?: string } }) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/purchases");

  const suppliers = await prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="New purchase" subtitle="Record a device procurement" />
      <PurchaseForm suppliers={suppliers} defaultSupplierId={searchParams.supplierId} />
    </div>
  );
}
