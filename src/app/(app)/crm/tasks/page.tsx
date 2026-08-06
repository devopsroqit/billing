import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getSessionUser, canEditCRM } from "@/lib/auth";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  isTaskClosed,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/constants";
import { PageHeader, StatusBadge } from "@/components/ui";
import { TaskStatusSelect } from "@/components/crm/TaskStatusSelect";

export const dynamic = "force-dynamic";

// "My tasks" — everything assigned to or created by the current user, across
// deals/companies/contacts. Overdue open tasks are highlighted in red.
export default async function MyTasksPage({ searchParams }: { searchParams: { status?: string } }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const editable = await canEditCRM(me);

  const status = searchParams.status ?? "";

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        { OR: [{ assigneeUserId: me.id }, { createdById: me.id }] },
        status ? { status } : {},
      ],
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      deal: { select: { id: true, title: true } },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const recordLink = (t: (typeof tasks)[number]) => {
    if (t.deal) return { href: `/crm/deals/${t.deal.id}`, label: t.deal.title };
    if (t.company) return { href: `/crm/companies/${t.company.id}`, label: t.company.name };
    if (t.contact) return { href: `/crm/contacts/${t.contact.id}`, label: `${t.contact.firstName} ${t.contact.lastName}`.trim() };
    return null;
  };

  const openCount = tasks.filter((t) => !isTaskClosed(t.status)).length;

  return (
    <div>
      <PageHeader title="My tasks" subtitle={`${openCount} open · assigned to or created by you`} />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABELS[s as TaskStatus]}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary" type="submit">Filter</button>
        {status && <Link href="/crm/tasks" className="btn-secondary">Clear</Link>}
      </form>

      {tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm font-medium text-fg">No tasks</p>
          <p className="mt-1 text-sm text-muted">{status ? "Try clearing the filter." : "Tasks assigned to or created by you will show here."}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">Task</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                <th className="th">Due</th>
                <th className="th">Record</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((t) => {
                const link = recordLink(t);
                const overdue = !!t.dueAt && !isTaskClosed(t.status) && t.dueAt.getTime() < Date.now();
                const closed = isTaskClosed(t.status);
                return (
                  <tr key={t.id} className="hover:bg-surface-2">
                    <td className={`td font-medium ${closed ? "text-faint line-through" : "text-fg"}`}>
                      {t.title}
                      {t.description && <span className="block text-xs text-faint">{t.description}</span>}
                    </td>
                    <td className="td"><StatusBadge status={t.priority} label={TASK_PRIORITY_LABELS[t.priority as TaskPriority] ?? t.priority} /></td>
                    <td className="td">
                      {editable ? <TaskStatusSelect id={t.id} status={t.status} /> : <StatusBadge status={t.status} label={TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status} />}
                    </td>
                    <td className={`td ${overdue ? "font-medium text-red-600" : "text-muted"}`}>
                      {t.dueAt ? `${overdue ? "Overdue · " : ""}${format(t.dueAt, "d MMM yyyy, HH:mm")}` : "—"}
                    </td>
                    <td className="td text-muted">
                      {link ? <Link href={link.href} className="hover:underline">{link.label}</Link> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
