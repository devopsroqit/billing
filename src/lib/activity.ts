import { prisma } from "@/lib/db";

// Writes one read-only Activity audit-log row. Called from every CRM mutation
// (see src/app/crm-actions.ts). Activity is the single source of truth for a
// record's lifecycle, so keep the summary human-readable and capture
// previous/new values + the deal-stage snapshot where relevant.
export async function logActivity(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  dealStage?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
}) {
  await prisma.activity.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary.slice(0, 500),
      field: input.field ?? null,
      previousValue: input.previousValue?.slice(0, 500) ?? null,
      newValue: input.newValue?.slice(0, 500) ?? null,
      dealStage: input.dealStage ?? null,
      companyId: input.companyId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
    },
  });
}

// Extracts @mentions from a comment body. Supports "@email@domain" and
// "@name" tokens; returns the raw handles (resolution happens in the caller).
export function parseMentions(body: string): string[] {
  const matches = body.match(/@[\w.+-]+(?:@[\w.-]+)?/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}
