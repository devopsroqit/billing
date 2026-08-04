import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/crm/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage({ searchParams }: { searchParams: { accountId?: string } }) {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/contacts");

  const [accounts, users] = await Promise.all([
    prisma.account.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="New contact" subtitle="Add a person to the CRM." />
      <ContactForm accounts={accounts} users={users} presetAccountId={searchParams.accountId} />
    </div>
  );
}
