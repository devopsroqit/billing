import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CompanyForm } from "@/components/crm/CompanyForm";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !(await canEditCRM(me))) redirect(`/crm/companies/${params.id}`);

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit company" subtitle={company.name} />
      <CompanyForm
        company={{
          id: company.id,
          name: company.name,
          relationshipType: company.relationshipType,
          source: company.source,
          size: company.size,
          domains: company.domains,
          categories: company.categories,
          primaryLocation: company.primaryLocation,
          teamSize: company.teamSize,
          description: company.description,
          ownerId: company.ownerId,
        }}
        users={users}
      />
    </div>
  );
}
