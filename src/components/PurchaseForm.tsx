import { savePurchase } from "@/app/actions";
import { CURRENCIES } from "@/lib/constants";

type PurchaseData = {
  id: string;
  supplierId: string | null;
  purchaseDate: Date;
  reference: string | null;
  currency: string;
  amountMinor: number;
  quantity: number;
  notes: string | null;
};

type SupplierOption = { id: string; name: string };

const toDateInput = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function PurchaseForm({
  purchase,
  suppliers,
  defaultSupplierId,
}: {
  purchase?: PurchaseData;
  suppliers: SupplierOption[];
  defaultSupplierId?: string;
}) {
  return (
    <form action={savePurchase} className="card space-y-5 p-6">
      {purchase && <input type="hidden" name="id" value={purchase.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Supplier</label>
          <select className="input" name="supplierId" defaultValue={purchase?.supplierId ?? defaultSupplierId ?? ""}>
            <option value="">— Select supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Purchase date</label>
          <input className="input" type="date" name="purchaseDate" defaultValue={toDateInput(purchase?.purchaseDate) || toDateInput(new Date())} />
        </div>
        <div>
          <label className="label">PO / Invoice no.</label>
          <input className="input" name="reference" defaultValue={purchase?.reference ?? ""} placeholder="e.g. PO-2026-014" />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input className="input" type="number" min="0" name="quantity" defaultValue={purchase?.quantity ?? 1} />
        </div>
        <div>
          <label className="label">Currency</label>
          <select className="input" name="currency" defaultValue={purchase?.currency ?? "INR"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Total amount</label>
          <input className="input" type="number" step="0.01" min="0" name="amount" defaultValue={purchase ? purchase.amountMinor / 100 : ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={2} defaultValue={purchase?.notes ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{purchase ? "Save changes" : "Create purchase"}</button>
        <a className="btn-secondary" href="/purchases">Cancel</a>
      </div>
    </form>
  );
}
