import { saveSupplier } from "@/app/actions";
import { SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS } from "@/lib/constants";

type SupplierData = {
  id: string;
  name: string;
  type: string;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  active: boolean;
};

export function SupplierForm({ supplier }: { supplier?: SupplierData }) {
  return (
    <form action={saveSupplier} className="card space-y-5 p-6">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Supplier / OEM name</label>
          <input className="input" name="name" defaultValue={supplier?.name} placeholder="e.g. Teltonika" required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="type" defaultValue={supplier?.type ?? "OEM"}>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" name="website" defaultValue={supplier?.website ?? ""} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Contact name</label>
          <input className="input" name="contactName" defaultValue={supplier?.contactName ?? ""} />
        </div>
        <div>
          <label className="label">Contact email</label>
          <input className="input" name="contactEmail" type="email" defaultValue={supplier?.contactEmail ?? ""} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" name="phone" defaultValue={supplier?.phone ?? ""} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" name="gstin" defaultValue={supplier?.gstin ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" name="address" rows={2} defaultValue={supplier?.address ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
        </div>
        <div className="flex items-center sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" name="active" defaultChecked={supplier ? supplier.active : true} className="h-4 w-4 rounded border-border" />
            Active
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{supplier ? "Save changes" : "Create supplier"}</button>
        <a className="btn-secondary" href="/suppliers">Cancel</a>
      </div>
    </form>
  );
}
