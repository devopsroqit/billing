import { prisma } from "./db";
import type { EmailType } from "./constants";

// Email delivery. Messages are first persisted to the EmailOutbox table (so the
// whole compose -> queue -> send flow is visible in the UI), then delivered via
// Resend (https://resend.com). If RESEND_API_KEY is not set the send is a no-op
// that just logs — so local/preview runs never fail and nothing is lost (the
// message stays QUEUED until a configured environment flushes it).

type QueueArgs = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  body: string;
  type: EmailType;
  entryId?: string | null;
};

export async function queueEmail(args: QueueArgs) {
  return prisma.emailOutbox.create({
    data: {
      toEmail: args.toEmail,
      toName: args.toName ?? null,
      subject: args.subject,
      body: args.body,
      type: args.type,
      entryId: args.entryId ?? null,
      status: "QUEUED",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Whether real email sending is configured for this environment. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// Deliver a single message through Resend. Throws on a provider error so the
// caller can mark the outbox row FAILED and surface it.
async function deliver(toEmail: string, subject: string, body: string, toName?: string | null): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "ROQIT Billing <onboarding@resend.dev>";
  if (!key) {
    // Not configured — leave a trace and no-op so the flow still works.
    console.log(`[email:disabled] would send "${subject}" to ${toEmail}`);
    return;
  }

  const to = toName ? `${toName} <${toEmail}>` : toEmail;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap">${escapeHtml(
    body,
  )}</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text: body, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/** Send every queued email. Returns how many were processed. */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const queued = await prisma.emailOutbox.findMany({
    where: { status: "QUEUED", scheduledFor: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  let failed = 0;
  for (const msg of queued) {
    try {
      await deliver(msg.toEmail, msg.subject, msg.body, msg.toName);
      await prisma.emailOutbox.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), error: null },
      });
      sent++;
    } catch (e) {
      await prisma.emailOutbox.update({
        where: { id: msg.id },
        data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) },
      });
      failed++;
    }
  }
  return { sent, failed };
}

/** Queue a welcome email for a newly-added team member and try to send it now. */
export async function sendWelcomeEmail(args: {
  toEmail: string;
  toName: string;
  roleLabel: string;
  tempPassword?: string;
}) {
  const appUrl = (process.env.APP_URL || "https://billing-six-xi.vercel.app").replace(/\/+$/, "");
  const body = [
    `Hi ${args.toName},`,
    ``,
    `You've been added to the ROQIT Billing tracker as ${args.roleLabel}.`,
    ``,
    `Sign in here: ${appUrl}/login`,
    `Email: ${args.toEmail}`,
    ...(args.tempPassword
      ? [
          `Temporary password: ${args.tempPassword}`,
          ``,
          `For security, ask an admin to change your password after your first sign-in.`,
        ]
      : [`Your password was set by an admin — ask them if you don't have it yet.`]),
    ``,
    `— ROQIT Billing`,
  ].join("\n");

  await queueEmail({
    toEmail: args.toEmail,
    toName: args.toName,
    subject: "You've been added to ROQIT Billing",
    body,
    type: "GENERIC",
  });
  // Deliver right away (also flushes any other pending messages).
  await flushOutbox();
}
