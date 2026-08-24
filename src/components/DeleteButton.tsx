"use client";

import { useTransition } from "react";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

// Runs a bound server action after an in-app confirm modal. Server actions can
// be passed to client components as props, so callers do e.g.
//   <DeleteButton action={deletePurchase.bind(null, id)} />
export function DeleteButton({
  action,
  label = "Delete",
  confirmText = "Are you sure? This can't be undone.",
  confirmTitle = "Delete this record?",
  successMessage = "Deleted.",
  className = "btn-secondary text-red-600",
}: {
  action: () => Promise<unknown>;
  label?: string;
  confirmText?: string;
  confirmTitle?: string;
  successMessage?: string | null;
  className?: string;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({ title: confirmTitle, body: confirmText, confirmLabel: label, danger: true });
        if (!ok) return;
        start(() =>
          action().then(() => {
            if (successMessage) toast.success(successMessage);
          }),
        );
      }}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
