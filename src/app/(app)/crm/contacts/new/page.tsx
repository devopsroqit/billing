import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/crm/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage({ searchParams }: { searchParams: { companyId?: string } }) {
  const me = await getSessionUser();
  if (!me || !(await canEditCRM(me))) redirect("/crm/contacts");

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="New contact" subtitle="Add a person to the CRM." />
      <ContactForm companies={companies} users={users} presetCompanyId={searchParams.companyId} />
    </div>
  );
}
