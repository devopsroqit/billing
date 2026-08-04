import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AccountForm } from "@/components/crm/AccountForm";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !canEdit(me.role)) redirect("/crm/accounts");

  const account = await prisma.account.findUnique({ where: { id: params.id } });
  if (!account) notFound();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${account.name}`} subtitle="Update account details." />
      <AccountForm account={account} users={users} />
    </div>
  );
}
