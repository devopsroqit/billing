"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem } from "@/components/crm/ActionsMenu";
import { deleteContact } from "@/app/crm-actions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

// Actions menu for a contact record. Confirms before applying.
export function ContactActions({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [pending, start] = useTransition();

  return (
    <ActionsMenu pending={pending}>
      {(close) => (
        <MenuItem
          danger
          onClick={async () => {
            close();
            const ok = await confirm({ title: "Delete this contact?", body: `Delete ${name}? This can't be undone.`, confirmLabel: "Delete", danger: true });
            if (!ok) return;
            start(() =>
              Promise.resolve(deleteContact(contactId)).then(() => {
                toast.success("Contact deleted.");
                router.refresh();
              }),
            );
          }}
        >
          Delete contact
        </MenuItem>
      )}
    </ActionsMenu>
  );
}
