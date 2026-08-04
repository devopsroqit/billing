"use client";

import { useMemo, useState, useTransition } from "react";

type Member = { id: string; name: string; email: string; role: string };

// Recipient picker + "Run alerts now" trigger. Tick the team members who should
// receive the reminders; with none ticked the run falls back to every active
// Admin & Editor (the default office team). The selected ids are passed to the
// server action, which forwards them to runAlerts().
export function AlertsRunner({
  members,
  action,
  label = "Run alerts now",
}: {
  members: Member[];
  action: (recipientUserIds: string[]) => Promise<{ message: string }>;
  label?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string>("");

  const allSelected = members.length > 0 && selected.length === members.length;
  const noneSelected = selected.length === 0;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : members.map((m) => m.id));
  }

  function onRun() {
    setMsg("");
    startTransition(async () => {
      try {
        const result = await action(selected);
        setMsg(result?.message ?? "Done.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">Recipients</span>
          {members.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-brand-600"
                checked={allSelected}
                onChange={toggleAll}
              />
              Select all
            </label>
          )}
        </div>

        {members.length === 0 ? (
          <p className="text-xs text-faint">No active Admins or Editors to send to.</p>
        ) : (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {members.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-brand-600"
                  checked={selectedSet.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <span className="text-fg">{m.name}</span>
                <span className="text-xs text-faint">{m.email}</span>
              </label>
            ))}
          </div>
        )}

        <p className="mt-2 text-xs text-faint">
          {noneSelected
            ? "None ticked — reminders go to all active Admins & Editors."
            : `Reminders go only to the ${selected.length} ticked member(s).`}
        </p>
      </div>

      <div className="flex items-center gap-3 self-end">
        <button className="btn-primary" onClick={onRun} disabled={pending}>
          {pending ? "Working…" : label}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
