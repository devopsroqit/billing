import { saveUser } from "@/app/actions";
import { ROLES, ROLE_LABELS, ROLE_HINTS } from "@/lib/constants";

type UserData = { id: string; name: string; email: string; role: string };

export function UserForm({ user }: { user?: UserData }) {
  return (
    <form action={saveUser} className="card space-y-5 p-6">
      {user && <input type="hidden" name="id" value={user.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" defaultValue={user?.name} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" name="email" type="email" defaultValue={user?.email} required />
        </div>
      </div>

      <div>
        <label className="label">Role</label>
        <select className="input" name="role" defaultValue={user?.role ?? "VIEWER"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">{user ? "New password (leave blank to keep)" : "Password"}</label>
        <input className="input" name="password" type="text" placeholder="at least 6 characters" autoComplete="new-password" />
        <p className="mt-1 text-xs text-faint">Share this with the member so they can sign in.</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" type="submit">{user ? "Save changes" : "Add member"}</button>
        <a className="btn-secondary" href="/team">Cancel</a>
      </div>
    </form>
  );
}
