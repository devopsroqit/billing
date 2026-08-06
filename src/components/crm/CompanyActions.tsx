"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem, MenuDivider } from "@/components/crm/ActionsMenu";
import { toggleCompanyActive, deleteCompany } from "@/app/crm-actions";

// Actions menu for a company record. Each action confirms before applying.
export function CompanyActions({ companyId, name, active }: { companyId: string; name: string; active: boolean }) {
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
          <MenuItem
            onClick={() => run(close, active ? `Deactivate company “${name}”?` : `Reactivate company “${name}”?`, () => toggleCompanyActive(companyId))}
          >
            {active ? "Deactivate" : "Reactivate"}
          </MenuItem>
          <MenuDivider />
          <MenuItem danger onClick={() => run(close, `Delete “${name}”? This can't be undone. Contacts and deals are kept (unlinked); activities are removed.`, () => deleteCompany(companyId))}>
            Delete company
          </MenuItem>
        </>
      )}
    </ActionsMenu>
  );
}
