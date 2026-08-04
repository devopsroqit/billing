import { prisma } from "./db";
import { queueEmail } from "./email";
import { formatMoney } from "./money";
import type { Currency } from "./constants";
import { format, differenceInCalendarDays } from "date-fns";

// The alert engine. Run it on a schedule (see scripts/run-alerts.ts) or on
// demand from the Alerts page. It:
//   1. Marks unpaid, past-due payment rows as OVERDUE.
//   2. Queues a "due soon" reminder for rows due within ALERT_DUE_SOON_DAYS.
//   3. Queues an "overdue" reminder for rows past their due date.
// Reminders go to the office team (all active Admins & Editors) so someone
// arranges the vendor payment. It never queues the same reminder to the same
// person for the same row twice in one day.

function dueSoonWindow(): number {
  const n = Number(process.env.ALERT_DUE_SOON_DAYS ?? "5");
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/** The best single amount to quote for a row, preferring INR then USD then EUR. */
function primaryAmount(e: {
  amountInrPaise: number;
  amountUsdCents: number;
  amountEurCents: number;
}): { minor: number; currency: Currency } {
  if (e.amountInrPaise > 0) return { minor: e.amountInrPaise, currency: "INR" };
  if (e.amountUsdCents > 0) return { minor: e.amountUsdCents, currency: "USD" };
  if (e.amountEurCents > 0) return { minor: e.amountEurCents, currency: "EUR" };
  return { minor: 0, currency: "INR" };
}

async function alreadyQueuedToday(entryId: string, type: string, toEmail: string): Promise<boolean> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const existing = await prisma.emailOutbox.findFirst({
    where: { entryId, type, toEmail, createdAt: { gte: startOfToday } },
  });
  return existing !== null;
}

export type AlertRunResult = {
  markedOverdue: number;
  dueSoonQueued: number;
  overdueQueued: number;
};

export async function runAlerts(): Promise<AlertRunResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowDays = dueSoonWindow();

  const result: AlertRunResult = { markedOverdue: 0, dueSoonQueued: 0, overdueQueued: 0 };

  // Who gets reminded — the office team responsible for paying.
  const recipients = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "EDITOR"] } },
    select: { email: true, name: true },
  });
  if (recipients.length === 0) return result;

  // Unpaid rows that have a due date.
  const openEntries = await prisma.paymentEntry.findMany({
    where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { not: null } },
  });

  for (const e of openEntries) {
    if (!e.dueDate) continue;
    const daysUntilDue = differenceInCalendarDays(e.dueDate, today);
    const amt = primaryAmount(e);
    const amountStr = formatMoney(amt.minor, amt.currency);

    if (daysUntilDue < 0) {
      // Past due — flip to OVERDUE and remind.
      if (e.status !== "OVERDUE") {
        await prisma.paymentEntry.update({ where: { id: e.id }, data: { status: "OVERDUE" } });
        result.markedOverdue++;
      }
      for (const r of recipients) {
        if (await alreadyQueuedToday(e.id, "OVERDUE", r.email)) continue;
        await queueEmail({
          toEmail: r.email,
          toName: r.name,
          type: "OVERDUE",
          entryId: e.id,
          subject: `OVERDUE: ${e.serviceName} payment — ${amountStr}`,
          body: overdueBody(r.name, e.serviceName, amountStr, e.dueDate, -daysUntilDue),
        });
        result.overdueQueued++;
      }
    } else if (daysUntilDue <= windowDays) {
      // Coming due soon — gentle reminder.
      for (const r of recipients) {
        if (await alreadyQueuedToday(e.id, "DUE_SOON", r.email)) continue;
        await queueEmail({
          toEmail: r.email,
          toName: r.name,
          type: "DUE_SOON",
          entryId: e.id,
          subject: `Reminder: ${e.serviceName} due ${format(e.dueDate, "d MMM yyyy")}`,
          body: dueSoonBody(r.name, e.serviceName, amountStr, e.dueDate, daysUntilDue),
        });
        result.dueSoonQueued++;
      }
    }
  }

  return result;
}

function dueSoonBody(to: string, service: string, amount: string, dueDate: Date, days: number): string {
  const when = days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
  return [
    `Hi ${to},`,
    ``,
    `Heads up — the ${service} payment of ${amount} is due ${when} (${format(dueDate, "d MMM yyyy")}).`,
    ``,
    `Please arrange the payment before the due date to avoid any service interruption.`,
    ``,
    `— roqit Billing tracker`,
  ].join("\n");
}

function overdueBody(to: string, service: string, amount: string, dueDate: Date, daysLate: number): string {
  return [
    `Hi ${to},`,
    ``,
    `The ${service} payment of ${amount} was due on ${format(dueDate, "d MMM yyyy")} and is now ${daysLate} day${daysLate === 1 ? "" : "s"} overdue.`,
    ``,
    `Please make the payment at the earliest and record it in the tracker.`,
    ``,
    `— roqit Billing tracker`,
  ].join("\n");
}
