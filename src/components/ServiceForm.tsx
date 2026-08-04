import { saveService } from "@/app/actions";
import {
  VENDOR_TYPES,
  VENDOR_TYPE_LABELS,
  BILLING_FREQUENCIES,
  BILLING_FREQUENCY_LABELS,
  CURRENCIES,
} from "@/lib/constants";

type ServiceData = {
  id: string;
  name: string;
  vendorType: string;
  billingFrequency: string;
  currency: string;
  dueDayOfMonth: number | null;
  defaultInrPaise: number;
  defaultUsdCents: number;
  defaultEurCents: number;
  vendorUrl: string | null;
  notes: string | null;
  active: boolean;
};

const money = (n: number) => (n ? (n / 100).toString() : "");

export function ServiceForm({ service, backHref = "/services" }: { service?: ServiceData; backHref?: string }) {
  return (
    <form action={saveService} className="card space-y-5 p-6">
      {service && <input type="hidden" name="id" value={service.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Service name</label>
          <input className="input" name="name" defaultValue={service?.name} placeholder="e.g. GitHub" required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="vendorType" defaultValue={service?.vendorType ?? "SUBSCRIPTION"}>
            {VENDOR_TYPES.map((t) => (
              <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Billing frequency</label>
          <select className="input" name="billingFrequency" defaultValue={service?.billingFrequency ?? "MONTHLY"}>
            {BILLING_FREQUENCIES.map((b) => (
              <option key={b} value={b}>{BILLING_FREQUENCY_LABELS[b]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Primary currency</label>
          <select className="input" name="currency" defaultValue={service?.currency ?? "INR"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due day of month (optional)</label>
          <input className="input" name="dueDayOfMonth" type="number" min="1" max="31" defaultValue={service?.dueDayOfMonth ?? ""} placeholder="e.g. 20" />
        </div>
      </div>

      <div>
        <p className="label">Default amounts (used to pre-fill each new month)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label text-xs">INR</label>
            <input className="input" name="defaultInr" type="number" step="0.01" min="0" defaultValue={money(service?.defaultInrPaise ?? 0)} />
          </div>
          <div>
            <label className="label text-xs">USD</label>
            <input className="input" name="defaultUsd" type="number" step="0.01" min="0" defaultValue={money(service?.defaultUsdCents ?? 0)} />
          </div>
          <div>
            <label className="label text-xs">EUR</label>
            <input className="input" name="defaultEur" type="number" step="0.01" min="0" defaultValue={money(service?.defaultEurCents ?? 0)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Vendor URL (optional)</label>
          <input className="input" name="vendorUrl" defaultValue={service?.vendorUrl ?? ""} placeholder="https://…" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" name="active" defaultChecked={service ? service.active : true} className="h-4 w-4 rounded border-border" />
            Active (include in monthly generation)
          </label>
        </div>
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea className="input" name="notes" rows={2} defaultValue={service?.notes ?? ""} />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{service ? "Save changes" : "Create service"}</button>
        <a className="btn-secondary" href={backHref}>Cancel</a>
      </div>
    </form>
  );
}
