import { prisma } from "@/lib/db";
import { getSessionUser, canEdit } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { RunButton } from "@/components/RunButton";
import { runAlertsAction, flushOutboxAction } from "@/app/actions";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  DUE_SOON: "Due soon",
  OVERDUE: "Overdue",
  GENERIC: "Notice",
};

export default async function AlertsPage() {
  const me = await getSessionUser();
  const editable = me ? canEdit(me.role) : false;
  const dueSoonDays = process.env.ALERT_DUE_SOON_DAYS ?? "5";

  const emails = await prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const queued = emails.filter((e) => e.status === "QUEUED").length;
  const liveEmail = emailConfigured();

  return (
    <div>
      <PageHeader title="Alerts & Email" subtitle="Automatic reminders for upcoming and overdue vendor payments" />

      {!liveEmail && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <strong>Email sending is not configured.</strong> Reminders are queued and listed below, but won&apos;t actually
          send until <code>RESEND_API_KEY</code> (and <code>EMAIL_FROM</code>) are set in the environment.
        </div>
      )}

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-fg">
              The alert engine flags <strong>overdue</strong> rows, and emails the team a reminder{" "}
              <strong>{dueSoonDays} days before</strong> a due date and again when a payment is overdue.{" "}
              {queued > 0 ? `${queued} message(s) waiting to send.` : "Outbox is clear."}
            </p>
            <p className="mt-1 text-xs text-faint">
              {liveEmail ? (
                <>Email delivery is <strong className="text-emerald-600 dark:text-emerald-400">live</strong> (Resend).</>
              ) : (
                <>Email delivery is <strong>off</strong> until configured.</>
              )}{" "}
              Run on a schedule via <code>npm run alerts:run</code>, or here. Reminders go to all active Admins &amp; Editors.
            </p>
          </div>
          {editable && (
            <div className="flex flex-col items-end gap-2">
              <RunButton action={runAlertsAction} label="Run alerts now" />
              <RunButton action={flushOutboxAction} label="Send queued email" className="btn-secondary" />
            </div>
          )}
        </div>
      </div>

      {emails.length === 0 ? (
        <EmptyState title="No emails yet" hint="Run the alert engine to populate the outbox." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-2">
              <tr>
                <th className="th">When</th>
                <th className="th">Type</th>
                <th className="th">To</th>
                <th className="th">Subject</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {emails.map((e) => (
                <tr key={e.id} className="hover:bg-surface-2">
                  <td className="td whitespace-nowrap text-muted">{format(e.createdAt, "d MMM, HH:mm")}</td>
                  <td className="td">{TYPE_LABEL[e.type] ?? e.type}</td>
                  <td className="td">
                    {e.toName ?? e.toEmail}
                    <span className="block text-xs text-faint">{e.toEmail}</span>
                  </td>
                  <td className="td max-w-md truncate" title={e.subject}>{e.subject}</td>
                  <td className="td"><StatusBadge status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
