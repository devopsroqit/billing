import { prisma } from "@/lib/db";
import { queueEmail } from "@/lib/email";

type NotifyInput = {
  userId?: string | null; // recipient
  actorId?: string | null; // who triggered it (never notified about their own action)
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
};

// Creates one in-app notification and mirrors it to email (queued to the
// EmailOutbox; actually sent by Resend when configured — see src/lib/email.ts).
export async function notify(input: NotifyInput) {
  const userId = input.userId;
  if (!userId) return;
  if (input.actorId && input.actorId === userId) return; // don't notify your own action

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, active: true } });
  if (!user || !user.active) return;

  await prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title.slice(0, 300),
      body: input.body?.slice(0, 1000) ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });

  if (user.email) {
    await queueEmail({
      toEmail: user.email,
      toName: user.name,
      subject: input.title,
      body: input.body ?? input.title,
      type: "GENERIC",
    });
  }
}

// Notify several recipients (de-duplicated; skips falsy ids and the actor).
export async function notifyMany(userIds: (string | null | undefined)[], input: Omit<NotifyInput, "userId">) {
  const seen = new Set<string>();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    await notify({ ...input, userId: id });
  }
}

// Resolve @mention handles (email or name) to User ids, given the roster.
export function resolveMentions(handles: string[], users: { id: string; name: string; email: string }[]): string[] {
  const ids = new Set<string>();
  for (const h of handles) {
    const lower = h.toLowerCase();
    const match = users.find((u) => u.email.toLowerCase() === lower || u.name.toLowerCase() === lower || u.name.toLowerCase().replace(/\s+/g, "") === lower);
    if (match) ids.add(match.id);
  }
  return Array.from(ids);
}
