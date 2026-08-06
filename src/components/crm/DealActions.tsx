"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { markProjectCompleted, markDealInactive, deleteDeal } from "@/app/crm-actions";

// Actions menu for a deal record — replaces the row of loose buttons that used
// to float above the card. Each action asks for confirmation before applying.
export function DealActions({
  dealId,
  title,
  active,
  projectCompleted,
}: {
  dealId: string;
  title: string;
  active: boolean;
  projectCompleted: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (confirmText: string, action: () => Promise<unknown>) => {
    setOpen(false);
    if (!window.confirm(confirmText)) return;
    start(() => void Promise.resolve(action()).then(() => router.refresh()));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
      >
        {pending ? "Working…" : "Actions"}
        <Icon name="chevron-down" className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
        >
          <button
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-2"
            onClick={() => { setOpen(false); router.push(`/crm/deals/${dealId}/edit`); }}
          >
            Edit deal
          </button>
          <button
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-2"
            onClick={() => run(
              projectCompleted ? `Reopen the project for “${title}”?` : `Mark the project for “${title}” as completed?`,
              () => markProjectCompleted(dealId),
            )}
          >
            {projectCompleted ? "Reopen project" : "Mark project completed"}
          </button>
          <button
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-surface-2"
            onClick={() => run(
              active ? `Mark deal “${title}” as inactive?` : `Reactivate deal “${title}”?`,
              () => markDealInactive(dealId),
            )}
          >
            {active ? "Mark inactive" : "Reactivate"}
          </button>
          <div className="border-t border-border" />
          <button
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-500/10"
            onClick={() => run(
              `Delete “${title}”? This can't be undone. Activities on the deal are removed.`,
              () => deleteDeal(dealId),
            )}
          >
            Delete deal
          </button>
        </div>
      )}
    </div>
  );
}
