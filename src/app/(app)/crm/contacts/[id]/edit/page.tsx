import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/crm/ContactForm";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/contacts");

  const contact = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!contact) notFound();

  const [accounts, users] = await Promise.all([
    prisma.account.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${contact.firstName} ${contact.lastName}`.trim()} subtitle="Update contact details." />
      <ContactForm contact={contact} accounts={accounts} users={users} />
    </div>
  );
}
