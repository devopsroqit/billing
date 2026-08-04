import { saveAccount } from "@/app/crm-actions";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from "@/lib/constants";

type AccountData = {
  id: string;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  ownerId: string | null;
};

type UserOption = { id: string; name: string };

export function AccountForm({ account, users }: { account?: AccountData; users: UserOption[] }) {
  return (
    <form action={saveAccount} className="card space-y-5 p-6">
      {account && <input type="hidden" name="id" value={account.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Company name</label>
          <input className="input" name="name" defaultValue={account?.name} placeholder="e.g. Bharat Logistics Pvt Ltd" required />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="type" defaultValue={account?.type ?? "PROSPECT"}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input" name="ownerId" defaultValue={account?.ownerId ?? ""}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Industry</label>
          <input className="input" name="industry" defaultValue={account?.industry ?? ""} placeholder="e.g. Logistics" />
        </div>
        <div>
          <label className="label">Website</label>
          <input className="input" name="website" defaultValue={account?.website ?? ""} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={account?.email ?? ""} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" name="phone" defaultValue={account?.phone ?? ""} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input" name="gstin" defaultValue={account?.gstin ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea className="input" name="address" rows={2} defaultValue={account?.address ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} defaultValue={account?.notes ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{account ? "Save changes" : "Create account"}</button>
        <a className="btn-secondary" href={account ? `/crm/accounts/${account.id}` : "/crm/accounts"}>Cancel</a>
      </div>
    </form>
  );
}
