import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DealForm } from "@/components/crm/DealForm";

export const dynamic = "force-dynamic";

export default async function NewDealPage({ searchParams }: { searchParams: { companyId?: string } }) {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/deals");

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="New Deal" subtitle="Add an opportunity to the pipeline." />
      <DealForm companies={companies} users={users} presetCompanyId={searchParams.companyId} />
    </div>
  );
}
