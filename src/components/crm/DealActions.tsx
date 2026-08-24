"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem, MenuDivider } from "@/components/crm/ActionsMenu";
import { markProjectCompleted, markDealInactive, deleteDeal } from "@/app/crm-actions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

// Actions menu for a deal record. Each action confirms before applying.
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
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();

  const run = async (
    close: () => void,
    prompt: { title: string; body?: string; confirmLabel?: string; danger?: boolean },
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    close();
    const ok = await confirm(prompt);
    if (!ok) return;
    start(() =>
      Promise.resolve(action()).then(() => {
        toast.success(successMessage);
        router.refresh();
      }),
    );
  };

  return (
    <ActionsMenu pending={pending}>
      {(close) => (
        <>
          <MenuItem onClick={() => { close(); router.push(`/crm/deals/${dealId}/edit`); }}>Edit deal</MenuItem>
          <MenuItem
            onClick={() => run(
              close,
              projectCompleted
                ? { title: "Reopen project?", body: `Reopen the project for “${title}”.`, confirmLabel: "Reopen" }
                : { title: "Mark project completed?", body: `Mark the project for “${title}” as completed.`, confirmLabel: "Mark completed" },
              () => markProjectCompleted(dealId),
              projectCompleted ? "Project reopened." : "Project marked completed.",
            )}
          >
            {projectCompleted ? "Reopen project" : "Mark project completed"}
          </MenuItem>
          <MenuItem
            onClick={() => run(
              close,
              active
                ? { title: "Mark deal inactive?", body: `Deal “${title}” will be hidden from active views.`, confirmLabel: "Mark inactive" }
                : { title: "Reactivate deal?", body: `Reactivate deal “${title}”.`, confirmLabel: "Reactivate" },
              () => markDealInactive(dealId),
              active ? "Deal marked inactive." : "Deal reactivated.",
            )}
          >
            {active ? "Mark inactive" : "Reactivate"}
          </MenuItem>
          <MenuDivider />
          <MenuItem danger onClick={() => run(
            close,
            { title: "Delete this deal?", body: `Delete “${title}”? This can't be undone. Activities on the deal are removed.`, confirmLabel: "Delete", danger: true },
            () => deleteDeal(dealId),
            "Deal deleted.",
          )}>
            Delete deal
          </MenuItem>
        </>
      )}
    </ActionsMenu>
  );
}
