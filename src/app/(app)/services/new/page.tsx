import { redirect } from "next/navigation";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ServiceForm } from "@/components/ServiceForm";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/services");

  return (
    <div className="max-w-3xl">
      <PageHeader title="New service" subtitle="Add a recurring vendor to track" />
      <ServiceForm />
    </div>
  );
}
