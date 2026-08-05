import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CompanyForm } from "@/components/crm/CompanyForm";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/companies");

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="New company" subtitle="Add an organization to the CRM." />
      <CompanyForm users={users} />
    </div>
  );
}
