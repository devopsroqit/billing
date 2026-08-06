"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

// Shared "Actions ▾" dropdown shell used by the record views. Handles the
// trigger button, open state, and outside-click / Escape close. The caller
// renders the menu items via a render prop that receives a `close` callback.
export function ActionsMenu({
  pending = false,
  children,
}: {
  pending?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <div role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  danger = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm ${danger ? "text-red-600 hover:bg-red-500/10" : "text-fg hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="border-t border-border" aria-hidden="true" />;
}
