"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { ACTIVITY_TYPE_ICONS, type ActivityType } from "@/lib/constants";

export type ActivityItem = {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  status: string;
  whenLabel: string;
  dueLabel: string | null;
  contactName: string | null;
};

type AddResult = { ok?: boolean; error?: string } | void;

export function Feed({
  items,
  editable,
  onToggle,
  onDelete,
}: {
  items: ActivityItem[];
  editable: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) return <p className="card p-4 text-sm text-muted">Nothing here yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const done = a.status === "DONE";
        const isTask = a.type === "TASK";
        return (
          <div key={a.id} className="card flex items-start gap-3 p-3">
            <div className="mt-0.5 text-muted">
              {isTask && editable ? (
                <button onClick={() => onToggle(a.id)} title={done ? "Reopen" : "Mark done"} className="text-muted hover:text-brand-600">
                  <Icon name="check-square" className={`h-4 w-4 ${done ? "text-emerald-600" : ""}`} />
                </button>
              ) : (
                <Icon name={ACTIVITY_TYPE_ICONS[a.type as ActivityType] ?? "folder"} className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${done ? "text-faint line-through" : "text-fg"}`}>{a.subject}</p>
                <span className="shrink-0 text-xs text-faint">{isTask && a.dueLabel ? `Due ${a.dueLabel}` : a.whenLabel}</span>
              </div>
              {a.body && <p className="mt-1 text-sm text-muted">{a.body}</p>}
              {a.contactName && <p className="mt-0.5 text-xs text-faint">{a.contactName}</p>}
            </div>
            {editable && (
              <button onClick={() => onDelete(a.id)} title="Delete" className="text-faint hover:text-red-600">
                <Icon name="trash" className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function NoteComposer({ onAdd }: { onAdd: (text: string) => Promise<AddResult> }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="card p-3">
      <textarea className="input text-sm" rows={2} placeholder="Write a note…" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={pending || !text.trim()}
          onClick={() => {
            setErr("");
            start(async () => {
              const r = await onAdd(text.trim());
              if (r && "error" in r && r.error) setErr(r.error);
              else setText("");
            });
          }}
        >
          {pending ? "Adding…" : "Add note"}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}

export function TaskComposer({ onAdd }: { onAdd: (subject: string, dueDate: string) => Promise<AddResult> }) {
  const [subject, setSubject] = useState("");
  const [due, setDue] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label className="label">Task</label>
          <input className="input text-sm" placeholder="e.g. Send proposal" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="label">Due</label>
          <input className="input text-sm" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <button
          className="btn-primary"
          disabled={pending || !subject.trim()}
          onClick={() => {
            setErr("");
            start(async () => {
              const r = await onAdd(subject.trim(), due);
              if (r && "error" in r && r.error) setErr(r.error);
              else { setSubject(""); setDue(""); }
            });
          }}
        >
          {pending ? "Adding…" : "Add task"}
        </button>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
