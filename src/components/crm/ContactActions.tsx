"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionsMenu, MenuItem } from "@/components/crm/ActionsMenu";
import { deleteContact } from "@/app/crm-actions";

// Actions menu for a contact record. Confirms before applying.
export function ContactActions({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <ActionsMenu pending={pending}>
      {(close) => (
        <MenuItem
          danger
          onClick={() => {
            close();
            if (!window.confirm(`Delete ${name}? This can't be undone.`)) return;
            start(() => void Promise.resolve(deleteContact(contactId)).then(() => router.refresh()));
          }}
        >
          Delete contact
        </MenuItem>
      )}
    </ActionsMenu>
  );
}
