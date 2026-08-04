import { redirect } from "next/navigation";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage() {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/suppliers");

  return (
    <div className="max-w-3xl">
      <PageHeader title="New supplier" subtitle="Add an OEM / party you procure from" />
      <SupplierForm />
    </div>
  );
}
