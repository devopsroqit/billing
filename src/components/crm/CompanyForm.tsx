import { saveCompany } from "@/app/crm-actions";
import {
  RELATIONSHIP_TYPES,
  RELATIONSHIP_TYPE_LABELS,
  COMPANY_SOURCES,
  COMPANY_SOURCE_LABELS,
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
} from "@/lib/constants";

type CompanyData = {
  id: string;
  name: string;
  relationshipType: string;
  source: string | null;
  size: string | null;
  domains: string | null;
  categories: string | null;
  primaryLocation: string | null;
  teamSize: number | null;
  description: string | null;
  ownerId: string | null;
};

type UserOption = { id: string; name: string };

export function CompanyForm({ company, users }: { company?: CompanyData; users: UserOption[] }) {
  return (
    <form action={saveCompany} className="card space-y-5 p-6">
      {company && <input type="hidden" name="id" value={company.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Company name</label>
          <input className="input" name="name" defaultValue={company?.name} placeholder="e.g. Bharat Logistics Pvt Ltd" required />
        </div>
        <div>
          <label className="label">Relationship type</label>
          <select className="input" name="relationshipType" defaultValue={company?.relationshipType ?? "PROSPECT"}>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{RELATIONSHIP_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Account owner</label>
          <select className="input" name="ownerId" defaultValue={company?.ownerId ?? ""}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Source</label>
          <select className="input" name="source" defaultValue={company?.source ?? ""}>
            <option value="">—</option>
            {COMPANY_SOURCES.map((s) => (
              <option key={s} value={s}>{COMPANY_SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Size</label>
          <select className="input" name="size" defaultValue={company?.size ?? ""}>
            <option value="">—</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>{COMPANY_SIZE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Domains</label>
          <input className="input" name="domains" defaultValue={company?.domains ?? ""} placeholder="tesla.com, tesla.in" />
        </div>
        <div>
          <label className="label">Team size</label>
          <input className="input" name="teamSize" type="number" min={0} defaultValue={company?.teamSize ?? ""} placeholder="e.g. 250" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Categories</label>
          <input className="input" name="categories" defaultValue={company?.categories ?? ""} placeholder="Logistics, Fleet, Enterprise (comma-separated)" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Primary location</label>
          <input className="input" name="primaryLocation" defaultValue={company?.primaryLocation ?? ""} placeholder="City, State" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" name="description" rows={3} defaultValue={company?.description ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{company ? "Save changes" : "Create company"}</button>
        <a className="btn-secondary" href={company ? `/crm/companies/${company.id}` : "/crm/companies"}>Cancel</a>
      </div>
    </form>
  );
}
