import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AccountForm } from "@/components/crm/AccountForm";

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/accounts");

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="New account" subtitle="Add a company to the CRM." />
      <AccountForm users={users} />
    </div>
  );
}
