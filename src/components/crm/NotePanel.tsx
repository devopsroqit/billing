"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNote, deleteNote } from "@/app/crm-actions";
import { useConfirm, useToast } from "@/components/ui/AppChrome";

export type NoteItem = {
  id: string;
  authorName: string | null;
  body: string;
  whenLabel: string;
};

type Anchor = { dealId?: string; companyId?: string; contactId?: string };

export function NotePanel({
  notes,
  anchor,
  editable,
}: {
  notes: NoteItem[];
  anchor: Anchor;
  editable: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function add() {
    const text = body.trim();
    if (!text) return;
    setError("");
    start(async () => {
      const r = await saveNote({ ...anchor, body: text });
      if (r && "error" in r && r.error) {
        setError(r.error);
      } else {
        setBody("");
        toast.success("Note added.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {editable && (
        <div className="card space-y-2 p-3">
          <textarea
            className="input"
            rows={2}
            placeholder="Write a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={add} disabled={pending || !body.trim()}>
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="card p-4 text-sm text-muted">No notes yet.</p>
      ) : (
        <div className="card divide-y divide-border">
          {notes.map((n) => (
            <div key={n.id} className="px-4 py-3">
              <p className="whitespace-pre-wrap text-sm text-fg">{n.body}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-faint">{n.authorName ?? "—"} · {n.whenLabel}</span>
                {editable && (
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={async () => {
                      const ok = await confirm({ title: "Delete this note?", body: "This can't be undone.", confirmLabel: "Delete", danger: true });
                      if (!ok) return;
                      await deleteNote(n.id);
                      toast.success("Note deleted.");
                      router.refresh();
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
