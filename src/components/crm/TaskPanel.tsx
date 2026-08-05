"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants";
import { saveTask, updateTaskStatus, toggleTaskDone, deleteTask } from "@/app/crm-actions";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigneeLabel: string | null;
  dueLabel: string | null;
  overdue: boolean;
  completedLabel: string | null;
};

type Option = { id: string; name: string };
type Anchor = { dealId?: string; companyId?: string; contactId?: string };

export function TaskPanel({
  tasks,
  users,
  anchor,
  editable,
}: {
  tasks: TaskItem[];
  users: Option[];
  anchor: Anchor;
  editable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await saveTask(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
      } else {
        form.reset();
        setAdding(false);
        router.refresh();
      }
    });
  }

  const refresh = () => router.refresh();

  return (
    <div className="space-y-3">
      {editable && (
        <div>
          {adding ? (
            <form onSubmit={onCreate} className="card space-y-3 p-4">
              {anchor.dealId && <input type="hidden" name="dealId" value={anchor.dealId} />}
              {anchor.companyId && <input type="hidden" name="companyId" value={anchor.companyId} />}
              {anchor.contactId && <input type="hidden" name="contactId" value={anchor.contactId} />}
              <input className="input" name="title" placeholder="Task title" required />
              <textarea className="input" name="description" rows={2} placeholder="Description (optional)" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Assignee (internal)</label>
                  <select className="input" name="assigneeUserId" defaultValue="">
                    <option value="">— None —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">…or external assignee</label>
                  <input className="input" name="assigneeExternal" placeholder="Name / email" />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select className="input" name="priority" defaultValue="MEDIUM">
                    {TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" name="status" defaultValue="TODO">
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Due date &amp; time</label>
                  <input className="input" name="dueAt" type="datetime-local" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex items-center gap-2">
                <button className="btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Add task"}</button>
                <button className="btn-secondary" type="button" onClick={() => { setAdding(false); setError(""); }}>Cancel</button>
              </div>
            </form>
          ) : (
            <button className="btn-primary inline-flex" onClick={() => setAdding(true)}>＋ Add task</button>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="card p-4 text-sm text-muted">No tasks yet.</p>
      ) : (
        <div className="card divide-y divide-border">
          {tasks.map((t) => {
            const closed = t.status === "DONE" || t.status === "CANCELLED";
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                  checked={t.status === "DONE"}
                  disabled={!editable}
                  onChange={() => editable && toggleTaskDone(t.id).then(refresh)}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${closed ? "text-faint line-through" : "text-fg"}`}>{t.title}</p>
                  {t.description && <p className="text-xs text-faint">{t.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={t.priority} label={TASK_PRIORITY_LABELS[t.priority as TaskPriority] ?? t.priority} />
                    {t.assigneeLabel && <span className="text-muted">{t.assigneeLabel}</span>}
                    {t.dueLabel && <span className={t.overdue ? "font-medium text-red-600" : "text-faint"}>{t.overdue ? "Overdue · " : "Due "}{t.dueLabel}</span>}
                    {t.completedLabel && <span className="text-emerald-600">✓ {t.completedLabel}</span>}
                  </div>
                </div>
                {editable ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="input h-8 py-0 text-xs"
                      value={t.status}
                      onChange={(e) => updateTaskStatus(t.id, e.target.value).then(refresh)}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => { if (confirm("Delete this task?")) deleteTask(t.id).then(refresh); }}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <StatusBadge status={t.status} label={TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
