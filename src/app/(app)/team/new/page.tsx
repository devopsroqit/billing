import { redirect } from "next/navigation";
import { getSessionUser, canManageUsers } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { UserForm } from "@/components/UserForm";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const me = await getSessionUser();
  if (!me || !canManageUsers(me.role)) redirect("/");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add team member" subtitle="Create a login for an office member" />
      <UserForm />
    </div>
  );
}
