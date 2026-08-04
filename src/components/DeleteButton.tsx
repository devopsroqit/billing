"use client";

import { useTransition } from "react";

// Runs a bound server action after a confirm() prompt. Server actions can be
// passed to client components as props, so callers do e.g.
//   <DeleteButton action={deletePurchase.bind(null, id)} />
export function DeleteButton({
  action,
  label = "Delete",
  confirmText = "Are you sure? This can't be undone.",
  className = "btn-secondary text-red-600",
}: {
  action: () => Promise<unknown>;
  label?: string;
  confirmText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm(confirmText)) start(() => action().then(() => undefined));
      }}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
