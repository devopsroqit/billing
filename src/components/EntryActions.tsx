"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markPaid, markPending, deleteEntry } from "@/app/actions";

// Compact inline actions for a payment row. Only rendered for editors/admins.
export function EntryActions({
  id,
  status,
  editHref,
}: {
  id: string;
  status: string;
  editHref: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      {status !== "PAID" ? (
        <button
          className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-emerald-500/10 disabled:opacity-50"
          disabled={pending}
          onClick={() => start(() => markPaid(id))}
          title="Mark as paid (today)"
        >
          ✓ Paid
        </button>
      ) : (
        <button
          className="rounded px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          disabled={pending}
          onClick={() => start(() => markPending(id))}
          title="Reopen as pending"
        >
          ↺ Reopen
        </button>
      )}
      <Link href={editHref} className="rounded px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2">
        Edit
      </Link>
      <button
        className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this row?")) start(() => deleteEntry(id));
        }}
        title="Delete row"
      >
        ✕
      </button>
    </div>
  );
}
