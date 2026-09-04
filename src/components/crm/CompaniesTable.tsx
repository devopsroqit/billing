"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { CompanyActions } from "@/components/crm/CompanyActions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";
import { bulkDeleteCompanies } from "@/app/crm-actions";
import {
  RELATIONSHIP_TYPE_LABELS,
  type RelationshipType,
} from "@/lib/constants";

export type CompanyRow = {
  id: string;
  name: string;
  primaryLocation: string | null;
  relationshipType: string;
  ownerId: string | null;
  contactsCount: number;
  dealsCount: number;
  active: boolean;
};

// The Companies list table. When `editable`, each row carries a checkbox and an
// Actions dropdown (Edit / Deactivate / Delete). A floating action bar above
// the table appears when any row is selected, so several companies can be
// deleted at once. Cascade semantics match single-row delete: contacts and
// deals are unlinked, activities are removed.
export function CompaniesTable({
  rows,
  users,
  editable,
}: {
  rows: CompanyRow[];
  users: { id: string; name: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allChecked = selected.size > 0 && selected.size === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(allIds)));
  }
  function clear() {
    setSelected(new Set());
  }

  async function onBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} ${ids.length === 1 ? "company" : "companies"}?`,
      body: `This can't be undone. Contacts and deals are kept (unlinked); activities are removed.`,
      confirmLabel: `Delete ${ids.length} ${ids.length === 1 ? "company" : "companies"}`,
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await bulkDeleteCompanies(ids);
      toast.success(`Deleted ${res.deleted} ${res.deleted === 1 ? "company" : "companies"}.`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {editable && selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium text-fg">
            {selected.size} {selected.size === 1 ? "company" : "companies"} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-secondary" onClick={clear} disabled={pending}>Clear</button>
            <button className="btn-danger" onClick={onBulkDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete selected"}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-2">
            <tr>
              {editable && (
                <th className="th w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allChecked; }}
                    onChange={toggleAll}
                    aria-label="Select all companies"
                  />
                </th>
              )}
              <th className="th">Name</th>
              <th className="th">Relationship</th>
              <th className="th">Owner</th>
              <th className="th text-right">Contacts</th>
              <th className="th text-right">Deals</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => {
              const checked = selected.has(c.id);
              return (
                <tr key={c.id} className={checked ? "bg-brand-500/5" : "hover:bg-surface-2"}>
                  {editable && (
                    <td className="td">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={checked}
                        onChange={() => toggle(c.id)}
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                  )}
                  <td className="td font-medium text-fg">
                    <Link href={`/crm/companies/${c.id}`} className="hover:underline">{c.name}</Link>
                    {c.primaryLocation && <span className="block text-xs text-faint">{c.primaryLocation}</span>}
                  </td>
                  <td className="td">
                    <StatusBadge
                      status={c.relationshipType}
                      label={RELATIONSHIP_TYPE_LABELS[c.relationshipType as RelationshipType] ?? c.relationshipType}
                    />
                  </td>
                  <td className="td text-muted">{c.ownerId ? userName.get(c.ownerId) ?? "—" : "—"}</td>
                  <td className="td text-right">{c.contactsCount}</td>
                  <td className="td text-right">{c.dealsCount}</td>
                  <td className="td">
                    <StatusBadge status={c.active ? "ACTIVE" : "INACTIVE"} label={c.active ? "Active" : "Inactive"} />
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/crm/companies/${c.id}`} className="text-xs font-medium text-muted hover:underline">Open</Link>
                      {editable && <CompanyActions companyId={c.id} name={c.name} active={c.active} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
