"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  changeDealOwner,
  addDealContributor,
  removeDealContributor,
  promoteContributor,
} from "@/app/crm-actions";

type Option = { id: string; name: string };

export function ContributorsPanel({
  dealId,
  ownerId,
  contributorIds,
  users,
  editable,
}: {
  dealId: string;
  ownerId: string | null;
  contributorIds: string[];
  users: Option[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState("");

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "—";
  const run = (p: Promise<unknown>) => start(() => void p.then(() => router.refresh()));

  // Members eligible to be added as a contributor: not the owner, not already one.
  const addable = users.filter((u) => u.id !== ownerId && !contributorIds.includes(u.id));

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Primary owner</p>
        <div className="mt-2">
          {editable ? (
            <select
              className="input"
              value={ownerId ?? ""}
              disabled={pending}
              onChange={(e) => run(changeDealOwner(dealId, e.target.value))}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-fg">{ownerId ? nameOf(ownerId) : "Unassigned"}</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Contributors</p>
        {contributorIds.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No contributors yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {contributorIds.map((id) => (
              <li key={id} className="flex items-center justify-between py-2">
                <span className="text-sm text-fg">{nameOf(id)}</span>
                {editable && (
                  <span className="flex items-center gap-3">
                    <button className="text-xs font-medium text-brand-600 hover:underline" disabled={pending} onClick={() => run(promoteContributor(dealId, id))}>
                      Make owner
                    </button>
                    <button className="text-xs font-medium text-red-600 hover:underline" disabled={pending} onClick={() => run(removeDealContributor(dealId, id))}>
                      Remove
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {editable && addable.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Add a contributor…</option>
              {addable.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button
              className="btn-primary shrink-0"
              disabled={pending || !pick}
              onClick={() => { if (pick) { run(addDealContributor(dealId, pick)); setPick(""); } }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
