"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDocument, deleteDocument } from "@/app/actions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

// A document attaches to exactly one owner — a payment entry, a purchase, a
// device, or a CRM record (deal / company / contact). Pass whichever id applies.
export function DocumentForm({
  entryId,
  purchaseId,
  deviceId,
  dealId,
  companyId,
  contactId,
}: {
  entryId?: string;
  purchaseId?: string;
  deviceId?: string;
  dealId?: string;
  companyId?: string;
  contactId?: string;
}) {
  const [kind, setKind] = useState<"FILE" | "LINK">("FILE");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await addDocument(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-dashed border-border p-4">
      {entryId && <input type="hidden" name="entryId" value={entryId} />}
      {purchaseId && <input type="hidden" name="purchaseId" value={purchaseId} />}
      {deviceId && <input type="hidden" name="deviceId" value={deviceId} />}
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      <input type="hidden" name="kind" value={kind} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("FILE")}
          className={`rounded-lg px-3 py-1 text-sm font-medium ${kind === "FILE" ? "bg-brand-600 text-white" : "bg-surface ring-1 ring-inset ring-border"}`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setKind("LINK")}
          className={`rounded-lg px-3 py-1 text-sm font-medium ${kind === "LINK" ? "bg-brand-600 text-white" : "bg-surface ring-1 ring-inset ring-border"}`}
        >
          Paste a link
        </button>
      </div>

      <div>
        <label className="label">Title (optional)</label>
        <input className="input" name="title" placeholder="e.g. AWS invoice — July 2026" />
      </div>

      {kind === "FILE" ? (
        <div>
          <label className="label">File (PDF, image, etc.)</label>
          <input className="input" type="file" name="file" />
        </div>
      ) : (
        <div>
          <label className="label">Link (Google Drive, vendor portal…)</label>
          <input className="input" name="externalUrl" placeholder="https://…" />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Attaching…" : "Attach document"}
      </button>
    </form>
  );
}

export function DeleteDocButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <button
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({ title: "Remove this document?", body: "The file link is detached from the record.", confirmLabel: "Remove", danger: true });
        if (!ok) return;
        start(() => deleteDocument(id).then(() => toast.success("Document removed.")));
      }}
    >
      Remove
    </button>
  );
}
