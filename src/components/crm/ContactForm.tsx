import { saveContact } from "@/app/crm-actions";

type ContactData = {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  notes: string | null;
  ownerId: string | null;
};

type Option = { id: string; name: string };

export function ContactForm({
  contact,
  companies,
  users,
  presetCompanyId,
}: {
  contact?: ContactData;
  companies: Option[];
  users: Option[];
  presetCompanyId?: string;
}) {
  const companyId = contact?.companyId ?? presetCompanyId ?? "";
  return (
    <form action={saveContact} className="card space-y-5 p-6">
      {contact && <input type="hidden" name="id" value={contact.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">First name</label>
          <input className="input" name="firstName" defaultValue={contact?.firstName} placeholder="Rajesh" required />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" name="lastName" defaultValue={contact?.lastName ?? ""} placeholder="Kumar" />
        </div>
        <div>
          <label className="label">Company</label>
          <select className="input" name="companyId" defaultValue={companyId}>
            <option value="">— No company —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input" name="ownerId" defaultValue={contact?.ownerId ?? ""}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Job title</label>
          <input className="input" name="title" defaultValue={contact?.title ?? ""} placeholder="Head of Operations" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" name="phone" defaultValue={contact?.phone ?? ""} />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={contact?.isPrimary ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Primary contact for the company
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} defaultValue={contact?.notes ?? ""} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{contact ? "Save changes" : "Create contact"}</button>
        <a className="btn-secondary" href={contact ? `/crm/contacts/${contact.id}` : "/crm/contacts"}>Cancel</a>
      </div>
    </form>
  );
}
