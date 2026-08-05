import { format } from "date-fns";
import type { TaskItem } from "@/components/crm/TaskPanel";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigneeUserId: string | null;
  assigneeExternal: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
};

// Maps a Task DB row (+ a user-id→name resolver) to the display item the
// TaskPanel expects. `overdue` = has a due date, is not closed, and is past due.
export function toTaskItem(t: TaskRow, userName: (id: string | null) => string | null): TaskItem {
  const closed = t.status === "DONE" || t.status === "CANCELLED";
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assigneeLabel: t.assigneeUserId ? userName(t.assigneeUserId) : t.assigneeExternal,
    dueLabel: t.dueAt ? format(t.dueAt, "d MMM yyyy, HH:mm") : null,
    overdue: !!t.dueAt && !closed && t.dueAt.getTime() < Date.now(),
    completedLabel: t.completedAt ? format(t.completedAt, "d MMM yyyy") : null,
  };
}
