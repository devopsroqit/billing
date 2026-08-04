import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EntryForm, type ServiceOption } from "@/components/EntryForm";
import { monthLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function NewEntryPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const user = await getSessionUser();
  if (!user || !canEdit(user.role)) redirect("/tracker");

  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const month = Number(searchParams.m) || now.getMonth() + 1;

  const services = await prisma.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const options: ServiceOption[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    vendorType: s.vendorType,
    billingFrequency: s.billingFrequency,
    dueDayOfMonth: s.dueDayOfMonth,
    defaultInr: s.defaultInrPaise,
    defaultUsd: s.defaultUsdCents,
    defaultEur: s.defaultEurCents,
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add payment row" subtitle={monthLabel(year, month)} />
      <EntryForm year={year} month={month} services={options} />
    </div>
  );
}
