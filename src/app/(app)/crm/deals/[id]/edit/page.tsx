import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DealForm } from "@/components/crm/DealForm";

export const dynamic = "force-dynamic";

const asDateInput = (d: Date | null) => (d ? format(d, "yyyy-MM-dd") : null);

export default async function EditDealPage({ params }: { params: { id: string } }) {
  const me = await getSessionUser();
  if (!me || !(await canEditCRM(me))) redirect(`/crm/deals/${params.id}`);

  const deal = await prisma.deal.findUnique({ where: { id: params.id } });
  if (!deal) notFound();

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit deal" subtitle={deal.title} />
      <DealForm
        deal={{
          id: deal.id,
          title: deal.title,
          companyId: deal.companyId,
          ownerId: deal.ownerId,
          stage: deal.stage,
          commercialModel: deal.commercialModel,
          currency: deal.currency,
          amountMinor: deal.amountMinor,
          arrMinor: deal.arrMinor,
          assetsInScope: deal.assetsInScope,
          packsInScope: deal.packsInScope,
          nextAction: deal.nextAction,
          contractSignedDate: asDateInput(deal.contractSignedDate),
          firstInvoiceDate: asDateInput(deal.firstInvoiceDate),
          firstPaymentDate: asDateInput(deal.firstPaymentDate),
          lossReason: deal.lossReason,
        }}
        companies={companies}
        users={users}
      />
    </div>
  );
}
