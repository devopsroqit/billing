import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ServiceForm } from "@/components/ServiceForm";

export const dynamic = "force-dynamic";

export default async function EditServicePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/services");

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${service.name}`} subtitle="Recurring service settings" />
      <ServiceForm service={service} />
    </div>
  );
}
