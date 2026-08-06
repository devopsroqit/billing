"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem, MenuDivider } from "@/components/crm/ActionsMenu";
import { markProjectCompleted, markDealInactive, deleteDeal } from "@/app/crm-actions";

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
  const [pending, start] = useTransition();

  const run = (close: () => void, confirmText: string, action: () => Promise<unknown>) => {
    close();
    if (!window.confirm(confirmText)) return;
    start(() => void Promise.resolve(action()).then(() => router.refresh()));
  };

  return (
    <ActionsMenu pending={pending}>
      {(close) => (
        <>
          <MenuItem onClick={() => { close(); router.push(`/crm/deals/${dealId}/edit`); }}>Edit deal</MenuItem>
          <MenuItem
            onClick={() => run(close, projectCompleted ? `Reopen the project for “${title}”?` : `Mark the project for “${title}” as completed?`, () => markProjectCompleted(dealId))}
          >
            {projectCompleted ? "Reopen project" : "Mark project completed"}
          </MenuItem>
          <MenuItem
            onClick={() => run(close, active ? `Mark deal “${title}” as inactive?` : `Reactivate deal “${title}”?`, () => markDealInactive(dealId))}
          >
            {active ? "Mark inactive" : "Reactivate"}
          </MenuItem>
          <MenuDivider />
          <MenuItem danger onClick={() => run(close, `Delete “${title}”? This can't be undone. Activities on the deal are removed.`, () => deleteDeal(dealId))}>
            Delete deal
          </MenuItem>
        </>
      )}
    </ActionsMenu>
  );
}
