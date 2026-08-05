"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import { updateTaskStatus } from "@/app/crm-actions";

// A compact status dropdown for a task row (used on the global "My tasks" list).
export function TaskStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      className="input h-8 py-0 text-xs"
      value={status}
      disabled={pending}
      onChange={(e) => start(() => void updateTaskStatus(id, e.target.value).then(() => router.refresh()))}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}
