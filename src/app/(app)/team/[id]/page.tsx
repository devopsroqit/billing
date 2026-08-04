import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserForm } from "@/components/UserForm";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !canManageUsers(me.role)) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${user.name}`} subtitle="Update role or reset password" />
      <UserForm user={user} />
    </div>
  );
}
