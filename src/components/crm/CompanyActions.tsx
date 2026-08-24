"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem, MenuDivider } from "@/components/crm/ActionsMenu";
import { toggleCompanyActive, deleteCompany } from "@/app/crm-actions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

// Actions menu for a company record. Each action confirms before applying.
export function CompanyActions({ companyId, name, active }: { companyId: string; name: string; active: boolean }) {
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
          <MenuItem onClick={() => { close(); router.push(`/crm/companies/${companyId}/edit`); }}>Edit company</MenuItem>
          <MenuItem
            onClick={() => run(
              close,
              active
                ? { title: "Deactivate company?", body: `Deactivate “${name}”.`, confirmLabel: "Deactivate" }
                : { title: "Reactivate company?", body: `Reactivate “${name}”.`, confirmLabel: "Reactivate" },
              () => toggleCompanyActive(companyId),
              active ? "Company deactivated." : "Company reactivated.",
            )}
          >
            {active ? "Deactivate" : "Reactivate"}
          </MenuItem>
          <MenuDivider />
          <MenuItem danger onClick={() => run(
            close,
            { title: "Delete this company?", body: `Delete “${name}”? This can't be undone. Contacts and deals are kept (unlinked); activities are removed.`, confirmLabel: "Delete", danger: true },
            () => deleteCompany(companyId),
            "Company deleted.",
          )}>
            Delete company
          </MenuItem>
        </>
      )}
    </ActionsMenu>
  );
}
