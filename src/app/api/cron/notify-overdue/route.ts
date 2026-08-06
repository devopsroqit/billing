import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { flushOutbox } from "@/lib/email";
import { isTaskClosed } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Daily sweep (wired via vercel.json crons): notify assignees of overdue tasks
// and flush any queued notification emails. Idempotent — a task is only
// notified while it still has an unread TASK_OVERDUE notification outstanding.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const overdue = await prisma.task.findMany({
    where: {
      dueAt: { lt: now },
      status: { notIn: ["DONE", "CANCELLED"] },
      assigneeUserId: { not: null },
    },
    select: { id: true, title: true, assigneeUserId: true, status: true, dealId: true, companyId: true, contactId: true },
  });

  let notified = 0;
  for (const t of overdue) {
    if (isTaskClosed(t.status) || !t.assigneeUserId) continue;
    const existing = await prisma.notification.findFirst({
      where: { userId: t.assigneeUserId, type: "TASK_OVERDUE", entityId: t.id, readAt: null },
      select: { id: true },
    });
    if (existing) continue; // already reminded; don't spam
    const link = t.dealId ? `/crm/deals/${t.dealId}` : t.companyId ? `/crm/companies/${t.companyId}` : t.contactId ? `/crm/contacts/${t.contactId}` : "/crm/tasks";
    await notify({ userId: t.assigneeUserId, type: "TASK_OVERDUE", title: `Task overdue: ${t.title}`, link, entityType: "TASK", entityId: t.id });
    notified++;
  }

  const flushed = await flushOutbox();
  return NextResponse.json({ ok: true, overdue: overdue.length, notified, emails: flushed });
}
