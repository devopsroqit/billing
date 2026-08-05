import { saveDeal } from "@/app/crm-actions";
import { minorToMajor } from "@/lib/money";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  COMMERCIAL_MODELS,
  COMMERCIAL_MODEL_LABELS,
  CURRENCIES,
} from "@/lib/constants";

type DealData = {
  id: string;
  title: string;
  companyId: string | null;
  ownerId: string | null;
  stage: string;
  commercialModel: string | null;
  currency: string;
  amountMinor: number;
  arrMinor: number;
  assetsInScope: number | null;
  packsInScope: string | null;
  nextAction: string | null;
  contractSignedDate: string | null; // yyyy-mm-dd
  firstInvoiceDate: string | null;
  firstPaymentDate: string | null;
  lossReason: string | null;
};

type Option = { id: string; name: string };

export function DealForm({
  deal,
  companies,
  users,
  presetCompanyId,
}: {
  deal?: DealData;
  companies: Option[];
  users: Option[];
  presetCompanyId?: string;
}) {
  const companyId = deal?.companyId ?? presetCompanyId ?? "";
  const amount = deal ? minorToMajor(deal.amountMinor) : "";
  const arr = deal ? minorToMajor(deal.arrMinor) : "";
  return (
    <form action={saveDeal} className="card space-y-5 p-6">
      {deal && <input type="hidden" name="id" value={deal.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Deal name</label>
          <input className="input" name="title" defaultValue={deal?.title} placeholder="e.g. Bobba Express — 500 tracker rollout" required />
        </div>
        <div>
          <label className="label">Company / Site</label>
          <select className="input" name="companyId" defaultValue={companyId}>
            <option value="">— No company —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Deal owner</label>
          <select className="input" name="ownerId" defaultValue={deal?.ownerId ?? ""}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Deal stage</label>
          <select className="input" name="stage" defaultValue={deal?.stage ?? "LEAD"}>
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Commercial model</label>
          <select className="input" name="commercialModel" defaultValue={deal?.commercialModel ?? ""}>
            <option value="">—</option>
            {COMMERCIAL_MODELS.map((m) => (
              <option key={m} value={m}>{COMMERCIAL_MODEL_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Next action</label>
          <input className="input" name="nextAction" defaultValue={deal?.nextAction ?? ""} placeholder="e.g. Complete initial deployment and signoff" />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" name="currency" defaultValue={deal?.currency ?? "INR"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="label">Deal value</label>
          <input className="input" name="amount" type="number" min={0} step="0.01" defaultValue={amount} placeholder="250000" />
        </div>
        <div>
          <label className="label">ARR value</label>
          <input className="input" name="arr" type="number" min={0} step="0.01" defaultValue={arr} placeholder="0" />
        </div>
        <div>
          <label className="label">Assets in scope</label>
          <input className="input" name="assetsInScope" type="number" min={0} defaultValue={deal?.assetsInScope ?? ""} placeholder="e.g. 500" />
        </div>
        <div>
          <label className="label">Packs in scope</label>
          <input className="input" name="packsInScope" defaultValue={deal?.packsInScope ?? ""} placeholder="e.g. Fleet + Cold-chain" />
        </div>
        <div>
          <label className="label">Contract signed date</label>
          <input className="input" name="contractSignedDate" type="date" defaultValue={deal?.contractSignedDate ?? ""} />
        </div>
        <div>
          <label className="label">First invoice date</label>
          <input className="input" name="firstInvoiceDate" type="date" defaultValue={deal?.firstInvoiceDate ?? ""} />
        </div>
        <div>
          <label className="label">First payment date</label>
          <input className="input" name="firstPaymentDate" type="date" defaultValue={deal?.firstPaymentDate ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Loss reason</label>
          <textarea className="input" name="lossReason" rows={2} defaultValue={deal?.lossReason ?? ""} placeholder="Fill in only if the deal was lost" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{deal ? "Save changes" : "Create deal"}</button>
        <a className="btn-secondary" href={deal ? `/crm/deals/${deal.id}` : "/crm/deals"}>Cancel</a>
      </div>
    </form>
  );
}
