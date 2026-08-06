"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, logout } from "@/lib/auth";
import { majorToMinor } from "@/lib/money";
import { logActivity, parseMentions } from "@/lib/activity";
import { notify, notifyMany, resolveMentions } from "@/lib/notify";
import {
  RELATIONSHIP_TYPES,
  COMPANY_SOURCES,
  COMPANY_SIZES,
  DEAL_STAGES,
  COMMERCIAL_MODELS,
  CURRENCIES,
  isTerminalStage,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";

// CRM server actions. Kept separate from the large src/app/actions.ts. Same
// conventions: zod-validate FormData, guard with requireCrmEditor(), write via
// prisma, record an audit row, then revalidate/redirect. Owner/creator are
// plain User ids (resolved to names in the UI).

// --- shared guards (mirrors src/app/actions.ts) ----------------------------
async function requireUser() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const dbUser = await prisma.user.findUnique({ where: { id: session.id }, select: { active: true } });
  if (!dbUser || !dbUser.active) {
    logout();
    redirect("/login");
  }
  return session;
}

// CRM editing is invite-gated: admins always, everyone else only if they've been
// granted canEditCrm by an admin. This replaces the plain role check for all CRM
// mutations, so a global Editor without the invite is view-only in CRM.
async function requireCrmEditor() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { canEditCrm: true } });
    if (!u?.canEditCrm) {
      throw new Error("You don't have edit access to CRM. Ask an admin to invite you.");
    }
  }
  return user;
}

async function audit(actorId: string, action: string, entity: string, entityId?: string, detail?: string) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, detail } });
}

/** Empty-string → null, and trim. For optional text inputs. */
function orNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/** Parse an optional integer input; empty/invalid → null. */
function orNullInt(v: unknown): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Parse an optional date input (e.g. an <input type="date">); empty → null. */
function parseDate(s?: string | null): Date | null {
  if (!s || !s.trim()) return null;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Parse a money input (major units, e.g. rupees) → minor units (paise). */
function orMinor(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n > 0 ? majorToMinor(n) : 0;
}

// ===========================================================================
// Companies
// ===========================================================================
const companySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  relationshipType: z.enum(RELATIONSHIP_TYPES),
  source: z.string().optional(),
  size: z.string().optional(),
  domains: z.string().optional(),
  categories: z.string().optional(),
  primaryLocation: z.string().optional(),
  teamSize: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  ownerId: z.string().optional(),
});

// Validate an optional enum-like value against its allowed set (blank = null).
function orNullEnum(v: unknown, allowed: readonly string[]): string | null {
  const s = orNull(v);
  return s && allowed.includes(s) ? s : null;
}

export async function saveCompany(formData: FormData) {
  const user = await requireCrmEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = companySchema.parse(raw);
  const data = {
    name: p.name.trim(),
    relationshipType: p.relationshipType,
    source: orNullEnum(p.source, COMPANY_SOURCES),
    size: orNullEnum(p.size, COMPANY_SIZES),
    domains: orNull(p.domains),
    categories: orNull(p.categories),
    primaryLocation: orNull(p.primaryLocation),
    teamSize: orNullInt(p.teamSize),
    description: orNull(p.description),
    email: orNull(p.email),
    phone: orNull(p.phone),
    gstin: orNull(p.gstin),
    ownerId: orNull(p.ownerId),
  };

  if (p.id) {
    await prisma.company.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Company", p.id, data.name);
    await logActivity({ actorId: user.id, action: "UPDATED", entityType: "COMPANY", entityId: p.id, summary: `Edited company ${data.name}`, companyId: p.id });
    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${p.id}`);
    redirect(`/crm/companies/${p.id}`);
  }
  const created = await prisma.company.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Company", created.id, data.name);
  await logActivity({ actorId: user.id, action: "CREATED", entityType: "COMPANY", entityId: created.id, summary: `Created company ${data.name}`, companyId: created.id });
  revalidatePath("/crm/companies");
  redirect(`/crm/companies/${created.id}`);
}

export async function toggleCompanyActive(id: string) {
  const user = await requireCrmEditor();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) return;
  await prisma.company.update({ where: { id }, data: { active: !c.active } });
  await audit(user.id, c.active ? "DEACTIVATE" : "ACTIVATE", "Company", id, c.name);
  await logActivity({ actorId: user.id, action: c.active ? "INACTIVATED" : "REACTIVATED", entityType: "COMPANY", entityId: id, summary: c.active ? `Deactivated company ${c.name}` : `Reactivated company ${c.name}`, companyId: id });
  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const user = await requireCrmEditor();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) return;
  // Contacts and deals are kept (their companyId is set to null via the schema's
  // onDelete: SetNull); activities and documents owned by the company cascade.
  await prisma.company.delete({ where: { id } });
  await audit(user.id, "DELETE", "Company", id, c.name);
  await logActivity({ actorId: user.id, action: "DELETED", entityType: "COMPANY", entityId: id, summary: `Deleted company ${c.name}` });
  revalidatePath("/crm/companies");
  redirect("/crm/companies");
}

// ===========================================================================
// Contacts
// ===========================================================================
const contactSchema = z.object({
  id: z.string().optional(),
  companyId: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function saveContact(formData: FormData) {
  const user = await requireCrmEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = contactSchema.parse(raw);
  const isPrimary = raw.isPrimary === "on" || raw.isPrimary === "true";
  const data = {
    companyId: orNull(p.companyId),
    firstName: p.firstName.trim(),
    lastName: (p.lastName ?? "").trim(),
    email: orNull(p.email),
    phone: orNull(p.phone),
    title: orNull(p.title),
    notes: orNull(p.notes),
    isPrimary,
    ownerId: orNull(p.ownerId),
  };

  const label = `${data.firstName} ${data.lastName}`.trim();
  if (p.id) {
    await prisma.contact.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Contact", p.id, label);
    await logActivity({ actorId: user.id, action: "UPDATED", entityType: "CONTACT", entityId: p.id, summary: `Edited contact ${label}`, contactId: p.id, companyId: data.companyId });
    revalidatePath("/crm/contacts");
    revalidatePath(`/crm/contacts/${p.id}`);
    if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
    redirect(`/crm/contacts/${p.id}`);
  }
  const created = await prisma.contact.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Contact", created.id, label);
  await logActivity({ actorId: user.id, action: "CREATED", entityType: "CONTACT", entityId: created.id, summary: `Created contact ${label}`, contactId: created.id, companyId: data.companyId });
  revalidatePath("/crm/contacts");
  if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
  redirect(`/crm/contacts/${created.id}`);
}

// Inline single-field edit from the record page. Whitelisted fields only.
const EDITABLE_COMPANY_FIELDS = [
  "name", "relationshipType", "source", "size", "domains", "categories",
  "primaryLocation", "teamSize", "description", "email", "phone", "gstin", "ownerId",
] as const;

export async function updateCompanyField(id: string, field: string, value: string) {
  const user = await requireCrmEditor();
  if (!(EDITABLE_COMPANY_FIELDS as readonly string[]).includes(field)) {
    return { error: "That field can't be edited." };
  }
  const trimmed = value.trim();
  if (field === "name" && !trimmed) return { error: "Name can't be empty." };
  if (field === "relationshipType" && !(RELATIONSHIP_TYPES as readonly string[]).includes(trimmed)) {
    return { error: "Invalid relationship type." };
  }
  if (field === "source" && trimmed && !(COMPANY_SOURCES as readonly string[]).includes(trimmed)) {
    return { error: "Invalid source." };
  }
  if (field === "size" && trimmed && !(COMPANY_SIZES as readonly string[]).includes(trimmed)) {
    return { error: "Invalid size." };
  }

  let stored: string | number | null;
  if (field === "name" || field === "relationshipType") stored = trimmed;
  else if (field === "teamSize") stored = orNullInt(trimmed);
  else stored = trimmed === "" ? null : trimmed;

  const data: Record<string, unknown> = { [field]: stored };
  const prev = await prisma.company.findUnique({ where: { id } });
  await prisma.company.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Company", id, field);
  await logActivity({
    actorId: user.id, action: field === "ownerId" ? "OWNER_CHANGED" : "UPDATED", entityType: "COMPANY", entityId: id,
    summary: `Updated ${field}`, field,
    previousValue: prev ? String((prev as Record<string, unknown>)[field] ?? "") : null,
    newValue: stored != null ? String(stored) : null, companyId: id,
  });
  revalidatePath(`/crm/companies/${id}`);
  revalidatePath("/crm/companies");
  return { ok: true };
}

const EDITABLE_CONTACT_FIELDS = [
  "firstName", "lastName", "title", "email", "phone", "companyId", "ownerId", "notes", "isPrimary",
] as const;

export async function updateContactField(id: string, field: string, value: string) {
  const user = await requireCrmEditor();
  if (!(EDITABLE_CONTACT_FIELDS as readonly string[]).includes(field)) {
    return { error: "That field can't be edited." };
  }
  const trimmed = value.trim();
  if (field === "firstName" && !trimmed) return { error: "First name can't be empty." };

  let stored: string | boolean | null;
  if (field === "isPrimary") stored = value === "true";
  else if (field === "firstName") stored = trimmed;
  else stored = trimmed === "" ? null : trimmed;

  const data: Record<string, unknown> = { [field]: stored };
  const before = await prisma.contact.findUnique({ where: { id } });
  await prisma.contact.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Contact", id, field);
  await logActivity({
    actorId: user.id, action: field === "ownerId" ? "OWNER_CHANGED" : "UPDATED", entityType: "CONTACT", entityId: id,
    summary: `Updated ${field}`, field,
    previousValue: before ? String((before as Record<string, unknown>)[field] ?? "") : null,
    newValue: stored != null ? String(stored) : null,
    contactId: id, companyId: before?.companyId ?? null,
  });
  revalidatePath(`/crm/contacts/${id}`);
  revalidatePath("/crm/contacts");
  if (before?.companyId) revalidatePath(`/crm/companies/${before.companyId}`);
  if (field === "companyId" && stored) revalidatePath(`/crm/companies/${stored as string}`);
  return { ok: true };
}

// ===========================================================================
// Deals
// ===========================================================================
const dealSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Deal name is required"),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  stage: z.enum(DEAL_STAGES),
  commercialModel: z.string().optional(),
  currency: z.enum(CURRENCIES),
  amount: z.coerce.number().min(0).default(0),
  arr: z.coerce.number().min(0).default(0),
  assetsInScope: z.string().optional(),
  packsInScope: z.string().optional(),
  nextAction: z.string().optional(),
  contractSignedDate: z.string().optional(),
  firstInvoiceDate: z.string().optional(),
  firstPaymentDate: z.string().optional(),
  lossReason: z.string().optional(),
});

export async function saveDeal(formData: FormData) {
  const user = await requireCrmEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = dealSchema.parse(raw);
  const data = {
    title: p.title.trim(),
    companyId: orNull(p.companyId),
    ownerId: orNull(p.ownerId),
    stage: p.stage,
    commercialModel: orNullEnum(p.commercialModel, COMMERCIAL_MODELS),
    currency: p.currency,
    amountMinor: majorToMinor(p.amount),
    arrMinor: majorToMinor(p.arr),
    assetsInScope: orNullInt(p.assetsInScope),
    packsInScope: orNull(p.packsInScope),
    nextAction: orNull(p.nextAction),
    contractSignedDate: parseDate(p.contractSignedDate),
    firstInvoiceDate: parseDate(p.firstInvoiceDate),
    firstPaymentDate: parseDate(p.firstPaymentDate),
    lossReason: orNull(p.lossReason),
    closedAt: isTerminalStage(p.stage) ? new Date() : null,
  };

  if (p.id) {
    await prisma.deal.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Deal", p.id, data.title);
    await logActivity({
      actorId: user.id, action: "UPDATED", entityType: "DEAL", entityId: p.id,
      summary: `Edited deal ${data.title}`, dealStage: data.stage,
      dealId: p.id, companyId: data.companyId,
    });
    revalidatePath("/crm/deals");
    revalidatePath(`/crm/deals/${p.id}`);
    if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
    redirect(`/crm/deals/${p.id}`);
  }
  const created = await prisma.deal.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Deal", created.id, data.title);
  await logActivity({
    actorId: user.id, action: "CREATED", entityType: "DEAL", entityId: created.id,
    summary: `Created deal ${data.title}`, dealStage: data.stage,
    dealId: created.id, companyId: data.companyId,
  });
  revalidatePath("/crm/deals");
  if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
  redirect(`/crm/deals/${created.id}`);
}

// Quick stage change from the list or record view. Manages closedAt.
export async function updateDealStage(id: string, stage: string) {
  const user = await requireCrmEditor();
  if (!(DEAL_STAGES as readonly string[]).includes(stage)) return { error: "Invalid stage." };
  const before = await prisma.deal.findUnique({ where: { id }, select: { companyId: true, closedAt: true, stage: true, title: true } });
  await prisma.deal.update({
    where: { id },
    data: { stage, closedAt: isTerminalStage(stage) ? (before?.closedAt ?? new Date()) : null },
  });
  await audit(user.id, "UPDATE", "Deal", id, `stage → ${stage}`);
  await logActivity({
    actorId: user.id, action: "STAGE_CHANGED", entityType: "DEAL", entityId: id,
    summary: `Moved deal to ${stage}`, field: "stage",
    previousValue: before?.stage, newValue: stage, dealStage: stage,
    dealId: id, companyId: before?.companyId,
  });
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
  if (before?.companyId) revalidatePath(`/crm/companies/${before.companyId}`);
  return { ok: true };
}

// Inline single-field edit from the record page. Whitelisted fields only.
const EDITABLE_DEAL_FIELDS = [
  "title", "stage", "commercialModel", "amount", "arr", "assetsInScope",
  "packsInScope", "nextAction", "companyId", "ownerId", "contractSignedDate",
  "firstInvoiceDate", "firstPaymentDate", "lossReason", "notes",
] as const;

// Money and date fields need type-specific coercion on inline save.
const DEAL_MONEY_FIELDS = new Set(["amount", "arr"]);
const DEAL_DATE_FIELDS = new Set(["contractSignedDate", "firstInvoiceDate", "firstPaymentDate"]);
// Map the UI money field name to its storage column.
const DEAL_MONEY_COLUMN: Record<string, string> = { amount: "amountMinor", arr: "arrMinor" };

export async function updateDealField(id: string, field: string, value: string) {
  const user = await requireCrmEditor();
  if (!(EDITABLE_DEAL_FIELDS as readonly string[]).includes(field)) {
    return { error: "That field can't be edited." };
  }
  const trimmed = value.trim();
  if (field === "title" && !trimmed) return { error: "Deal name can't be empty." };
  if (field === "stage" && !(DEAL_STAGES as readonly string[]).includes(trimmed)) {
    return { error: "Invalid stage." };
  }
  if (field === "commercialModel" && trimmed && !(COMMERCIAL_MODELS as readonly string[]).includes(trimmed)) {
    return { error: "Invalid commercial model." };
  }

  const data: Record<string, unknown> = {};
  if (DEAL_MONEY_FIELDS.has(field)) {
    data[DEAL_MONEY_COLUMN[field]] = orMinor(trimmed);
  } else if (DEAL_DATE_FIELDS.has(field)) {
    data[field] = parseDate(trimmed);
  } else if (field === "assetsInScope") {
    data[field] = orNullInt(trimmed);
  } else if (field === "stage") {
    data.stage = trimmed;
    data.closedAt = isTerminalStage(trimmed) ? new Date() : null;
  } else if (field === "title") {
    data.title = trimmed;
  } else {
    data[field] = trimmed === "" ? null : trimmed;
  }

  const before = await prisma.deal.findUnique({ where: { id } });
  await prisma.deal.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Deal", id, field);
  const action = field === "stage" ? "STAGE_CHANGED" : field === "ownerId" ? "OWNER_CHANGED" : "UPDATED";
  const prev = before ? (before as Record<string, unknown>)[DEAL_MONEY_FIELDS.has(field) ? DEAL_MONEY_COLUMN[field] : field] : undefined;
  await logActivity({
    actorId: user.id, action, entityType: "DEAL", entityId: id,
    summary: field === "stage" ? `Moved deal to ${trimmed}` : `Updated ${field}`,
    field, previousValue: prev != null ? String(prev) : null, newValue: trimmed || null,
    dealStage: field === "stage" ? trimmed : before?.stage ?? null,
    dealId: id, companyId: before?.companyId ?? null,
  });
  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm/deals");
  if (before?.companyId) revalidatePath(`/crm/companies/${before.companyId}`);
  if (field === "companyId" && data.companyId) revalidatePath(`/crm/companies/${data.companyId as string}`);
  return { ok: true };
}

export async function deleteDeal(id: string) {
  const user = await requireCrmEditor();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d) return;
  await prisma.deal.delete({ where: { id } });
  await audit(user.id, "DELETE", "Deal", id, d.title);
  // Anchor left null — the deal record is gone; this is a global audit entry.
  await logActivity({ actorId: user.id, action: "DELETED", entityType: "DEAL", entityId: id, summary: `Deleted deal ${d.title}`, companyId: d.companyId });
  revalidatePath("/crm/deals");
  if (d.companyId) revalidatePath(`/crm/companies/${d.companyId}`);
  redirect("/crm/deals");
}

// Toggle a deal's active flag (Mark Deal as Inactive / Reactivate).
export async function markDealInactive(id: string) {
  const user = await requireCrmEditor();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d) return;
  await prisma.deal.update({ where: { id }, data: { active: !d.active } });
  await audit(user.id, d.active ? "DEACTIVATE" : "ACTIVATE", "Deal", id, d.title);
  await logActivity({
    actorId: user.id, action: d.active ? "INACTIVATED" : "REACTIVATED", entityType: "DEAL", entityId: id,
    summary: d.active ? `Marked deal inactive` : `Reactivated deal`, dealStage: d.stage,
    dealId: id, companyId: d.companyId,
  });
  if (d.active) await notifyDealTeam(id, d.ownerId, user.id, "DEAL_INACTIVE", `Deal “${d.title}” was marked inactive`);
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
}

// Toggle a deal's project-completed marker (Mark Project as Completed / Reopen).
export async function markProjectCompleted(id: string) {
  const user = await requireCrmEditor();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d) return;
  const done = !d.projectCompletedAt;
  await prisma.deal.update({ where: { id }, data: { projectCompletedAt: done ? new Date() : null } });
  await audit(user.id, done ? "PROJECT_COMPLETED" : "PROJECT_REOPENED", "Deal", id, d.title);
  await logActivity({
    actorId: user.id, action: done ? "COMPLETED" : "REOPENED", entityType: "DEAL", entityId: id,
    summary: done ? `Marked project completed` : `Reopened project`, dealStage: d.stage,
    dealId: id, companyId: d.companyId,
  });
  if (done) await notifyDealTeam(id, d.ownerId, user.id, "PROJECT_COMPLETED", `Project “${d.title}” was marked completed`);
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${id}`);
}

// ===========================================================================
// Deal ownership & collaboration (spec §5)
// ===========================================================================
async function userLabel(id: string | null): Promise<string> {
  if (!id) return "Unassigned";
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u?.name ?? "someone";
}

// Change the single primary owner of a deal.
export async function changeDealOwner(dealId: string, userId: string) {
  const user = await requireCrmEditor();
  const before = await prisma.deal.findUnique({ where: { id: dealId }, select: { ownerId: true, companyId: true, stage: true, title: true } });
  if (!before) return { error: "Deal not found." };
  const newOwner = orNull(userId);
  await prisma.deal.update({ where: { id: dealId }, data: { ownerId: newOwner } });
  // The new owner shouldn't also be listed as a contributor.
  if (newOwner) await prisma.dealContributor.deleteMany({ where: { dealId, userId: newOwner } });
  const [prevName, newName] = await Promise.all([userLabel(before.ownerId), userLabel(newOwner)]);
  await audit(user.id, "OWNER_CHANGED", "Deal", dealId, `${prevName} → ${newName}`);
  await logActivity({
    actorId: user.id, action: "OWNER_CHANGED", entityType: "DEAL", entityId: dealId,
    summary: `Changed owner to ${newName}`, field: "ownerId", previousValue: prevName, newValue: newName,
    dealStage: before.stage, dealId, companyId: before.companyId,
  });
  const link = `/crm/deals/${dealId}`;
  if (newOwner) await notify({ actorId: user.id, userId: newOwner, type: "OWNER_CHANGED", title: `You’re now the owner of “${before.title}”`, link, entityType: "DEAL", entityId: dealId });
  await notify({ actorId: user.id, userId: before.ownerId, type: "OWNER_CHANGED", title: `Ownership of “${before.title}” moved to ${newName}`, link, entityType: "DEAL", entityId: dealId });
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${dealId}`);
  return { ok: true };
}

// Promote a contributor to primary owner; the previous owner becomes a contributor.
export async function promoteContributor(dealId: string, userId: string) {
  const user = await requireCrmEditor();
  if (!orNull(userId)) return { error: "Pick a contributor." };
  const before = await prisma.deal.findUnique({ where: { id: dealId }, select: { ownerId: true, companyId: true, stage: true, title: true } });
  if (!before) return { error: "Deal not found." };
  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: { ownerId: userId } }),
    prisma.dealContributor.deleteMany({ where: { dealId, userId } }),
    ...(before.ownerId && before.ownerId !== userId
      ? [prisma.dealContributor.upsert({
          where: { dealId_userId: { dealId, userId: before.ownerId } },
          create: { dealId, userId: before.ownerId },
          update: {},
        })]
      : []),
  ]);
  const [prevName, newName] = await Promise.all([userLabel(before.ownerId), userLabel(userId)]);
  await audit(user.id, "OWNER_CHANGED", "Deal", dealId, `${prevName} → ${newName} (promoted)`);
  await logActivity({
    actorId: user.id, action: "OWNER_CHANGED", entityType: "DEAL", entityId: dealId,
    summary: `Promoted ${newName} to owner`, field: "ownerId", previousValue: prevName, newValue: newName,
    dealStage: before.stage, dealId, companyId: before.companyId,
  });
  const link = `/crm/deals/${dealId}`;
  await notify({ actorId: user.id, userId, type: "OWNER_CHANGED", title: `You’re now the owner of “${before.title}”`, link, entityType: "DEAL", entityId: dealId });
  await notify({ actorId: user.id, userId: before.ownerId, type: "OWNER_CHANGED", title: `You’re now a contributor on “${before.title}”`, link, entityType: "DEAL", entityId: dealId });
  revalidatePath("/crm/deals");
  revalidatePath(`/crm/deals/${dealId}`);
  return { ok: true };
}

export async function addDealContributor(dealId: string, userId: string) {
  const user = await requireCrmEditor();
  if (!orNull(userId)) return { error: "Pick a team member." };
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { ownerId: true, companyId: true, stage: true, title: true } });
  if (!deal) return { error: "Deal not found." };
  if (deal.ownerId === userId) return { error: "That member is already the primary owner." };
  await prisma.dealContributor.upsert({
    where: { dealId_userId: { dealId, userId } },
    create: { dealId, userId },
    update: {},
  });
  const name = await userLabel(userId);
  await audit(user.id, "CONTRIBUTOR_ADDED", "Deal", dealId, name);
  await logActivity({
    actorId: user.id, action: "CONTRIBUTOR_ADDED", entityType: "COLLABORATOR", entityId: dealId,
    summary: `Added ${name} as a contributor`, newValue: name, dealStage: deal.stage, dealId, companyId: deal.companyId,
  });
  await notify({ actorId: user.id, userId, type: "CONTRIBUTOR_ADDED", title: `You were added to “${deal.title}”`, link: `/crm/deals/${dealId}`, entityType: "DEAL", entityId: dealId });
  revalidatePath(`/crm/deals/${dealId}`);
  return { ok: true };
}

export async function removeDealContributor(dealId: string, userId: string) {
  const user = await requireCrmEditor();
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { companyId: true, stage: true, title: true } });
  if (!deal) return { error: "Deal not found." };
  await prisma.dealContributor.deleteMany({ where: { dealId, userId } });
  const name = await userLabel(userId);
  await audit(user.id, "CONTRIBUTOR_REMOVED", "Deal", dealId, name);
  await logActivity({
    actorId: user.id, action: "CONTRIBUTOR_REMOVED", entityType: "COLLABORATOR", entityId: dealId,
    summary: `Removed ${name} as a contributor`, previousValue: name, dealStage: deal.stage, dealId, companyId: deal.companyId,
  });
  await notify({ actorId: user.id, userId, type: "CONTRIBUTOR_REMOVED", title: `You were removed from “${deal.title}”`, link: `/crm/deals/${dealId}`, entityType: "DEAL", entityId: dealId });
  revalidatePath(`/crm/deals/${dealId}`);
  return { ok: true };
}

// Notify a deal's owner + contributors of a lifecycle event (skips the actor).
async function notifyDealTeam(dealId: string, ownerId: string | null, actorId: string, type: string, title: string) {
  const contributors = await prisma.dealContributor.findMany({ where: { dealId }, select: { userId: true } });
  await notifyMany([ownerId, ...contributors.map((c) => c.userId)], {
    actorId, type, title, link: `/crm/deals/${dealId}`, entityType: "DEAL", entityId: dealId,
  });
}

// ===========================================================================
// Notes (user-authored) — distinct from the read-only Activity audit log
// ===========================================================================
export async function saveNote(input: {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  body: string;
}) {
  const user = await requireCrmEditor();
  const body = (input.body ?? "").trim();
  if (!body) return { error: "Add some text first." };
  await prisma.note.create({
    data: {
      body: body.slice(0, 5000),
      companyId: orNull(input.companyId),
      contactId: orNull(input.contactId),
      dealId: orNull(input.dealId),
      authorId: user.id,
    },
  });
  await logActivity({
    actorId: user.id,
    action: "NOTE_ADDED",
    entityType: "NOTE",
    summary: `Added a note`,
    newValue: body.slice(0, 200),
    companyId: orNull(input.companyId),
    contactId: orNull(input.contactId),
    dealId: orNull(input.dealId),
  });
  if (input.companyId) revalidatePath(`/crm/companies/${input.companyId}`);
  if (input.contactId) revalidatePath(`/crm/contacts/${input.contactId}`);
  if (input.dealId) revalidatePath(`/crm/deals/${input.dealId}`);
  return { ok: true };
}

export async function deleteNote(id: string) {
  const user = await requireCrmEditor();
  const n = await prisma.note.findUnique({ where: { id } });
  if (!n) return;
  await prisma.note.delete({ where: { id } });
  await audit(user.id, "DELETE", "Note", id, n.body.slice(0, 60));
  if (n.companyId) revalidatePath(`/crm/companies/${n.companyId}`);
  if (n.contactId) revalidatePath(`/crm/contacts/${n.contactId}`);
  if (n.dealId) revalidatePath(`/crm/deals/${n.dealId}`);
}

// ===========================================================================
// Activity comments (threaded discussion on an audit entry)
// ===========================================================================
export async function addActivityComment(input: { activityId: string; body: string; parentId?: string }) {
  const user = await requireCrmEditor();
  const body = (input.body ?? "").trim();
  if (!body) return { error: "Write something first." };
  const activity = await prisma.activity.findUnique({ where: { id: input.activityId } });
  if (!activity) return { error: "Activity not found." };
  await prisma.activityComment.create({
    data: {
      activityId: input.activityId,
      parentId: orNull(input.parentId),
      body: body.slice(0, 5000),
      authorId: user.id,
    },
  });
  await audit(user.id, "COMMENT", "Activity", input.activityId, body.slice(0, 60));
  // @mentions → in-app + email notifications.
  const handles = parseMentions(body);
  if (handles.length) {
    const roster = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true } });
    const mentioned = resolveMentions(handles, roster);
    const link = activity.dealId ? `/crm/deals/${activity.dealId}` : activity.companyId ? `/crm/companies/${activity.companyId}` : activity.contactId ? `/crm/contacts/${activity.contactId}` : undefined;
    await notifyMany(mentioned, {
      actorId: user.id, type: "TAGGED", title: `${user.name} mentioned you`,
      body: body.slice(0, 200), link, entityType: "COMMENT", entityId: input.activityId,
    });
  }
  if (activity.companyId) revalidatePath(`/crm/companies/${activity.companyId}`);
  if (activity.contactId) revalidatePath(`/crm/contacts/${activity.contactId}`);
  if (activity.dealId) revalidatePath(`/crm/deals/${activity.dealId}`);
  return { ok: true };
}

export async function deleteActivityComment(id: string) {
  const user = await requireCrmEditor();
  const c = await prisma.activityComment.findUnique({ where: { id }, include: { activity: true } });
  if (!c) return;
  await prisma.activityComment.delete({ where: { id } });
  await audit(user.id, "DELETE", "ActivityComment", id);
  if (c.activity.companyId) revalidatePath(`/crm/companies/${c.activity.companyId}`);
  if (c.activity.contactId) revalidatePath(`/crm/contacts/${c.activity.contactId}`);
  if (c.activity.dealId) revalidatePath(`/crm/deals/${c.activity.dealId}`);
}

export async function deleteContact(id: string) {
  const user = await requireCrmEditor();
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.contact.delete({ where: { id } });
  const cname = `${c.firstName} ${c.lastName}`.trim();
  await audit(user.id, "DELETE", "Contact", id, cname);
  await logActivity({ actorId: user.id, action: "DELETED", entityType: "CONTACT", entityId: id, summary: `Deleted contact ${cname}`, companyId: c.companyId });
  revalidatePath("/crm/contacts");
  if (c.companyId) revalidatePath(`/crm/companies/${c.companyId}`);
  redirect("/crm/contacts");
}

// ===========================================================================
// Tasks — a standalone unit of work (distinct from the Activity audit log).
// ===========================================================================
function revalidateTaskAnchors(t: { dealId?: string | null; companyId?: string | null; contactId?: string | null }) {
  revalidatePath("/crm/tasks");
  if (t.dealId) revalidatePath(`/crm/deals/${t.dealId}`);
  if (t.companyId) revalidatePath(`/crm/companies/${t.companyId}`);
  if (t.contactId) revalidatePath(`/crm/contacts/${t.contactId}`);
}

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assigneeUserId: z.string().optional(),
  assigneeExternal: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueAt: z.string().optional(),
  dealId: z.string().optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
});

export async function saveTask(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const user = await requireCrmEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the task fields." };
  }
  const p = parsed.data;
  const nowDone = p.status === "DONE";
  const data = {
    title: p.title.trim(),
    description: orNull(p.description),
    assigneeUserId: orNull(p.assigneeUserId),
    assigneeExternal: orNull(p.assigneeExternal),
    priority: p.priority,
    status: p.status,
    dueAt: parseDate(p.dueAt),
  };

  if (p.id) {
    const before = await prisma.task.findUnique({ where: { id: p.id } });
    const completion = nowDone
      ? { completedAt: before?.completedAt ?? new Date(), completedById: before?.completedById ?? user.id }
      : { completedAt: null, completedById: null };
    const t = await prisma.task.update({ where: { id: p.id }, data: { ...data, ...completion } });
    await audit(user.id, "UPDATE", "Task", p.id, data.title);
    await logActivity({
      actorId: user.id, action: "UPDATED", entityType: "TASK", entityId: t.id,
      summary: `Updated task “${data.title}”`, dealId: t.dealId, companyId: t.companyId, contactId: t.contactId,
    });
    // Notify the assignee if they were newly assigned to this task.
    if (t.assigneeUserId && t.assigneeUserId !== before?.assigneeUserId) {
      await notify({ actorId: user.id, userId: t.assigneeUserId, type: "TASK_ASSIGNED", title: `${user.name} assigned you a task`, body: t.title, link: taskLink(t), entityType: "TASK", entityId: t.id });
    }
    revalidateTaskAnchors(t);
    return { ok: true };
  }
  const t = await prisma.task.create({
    data: {
      ...data,
      ...(nowDone ? { completedAt: new Date(), completedById: user.id } : {}),
      dealId: orNull(p.dealId),
      companyId: orNull(p.companyId),
      contactId: orNull(p.contactId),
      createdById: user.id,
    },
  });
  await audit(user.id, "CREATE", "Task", t.id, data.title);
  await logActivity({
    actorId: user.id, action: "CREATED", entityType: "TASK", entityId: t.id,
    summary: `Created task “${data.title}”`, dealId: t.dealId, companyId: t.companyId, contactId: t.contactId,
  });
  if (t.assigneeUserId) {
    await notify({ actorId: user.id, userId: t.assigneeUserId, type: "TASK_ASSIGNED", title: `${user.name} assigned you a task`, body: t.title, link: taskLink(t), entityType: "TASK", entityId: t.id });
  }
  revalidateTaskAnchors(t);
  return { ok: true };
}

// A task's in-app link — its anchor record, else the global task list.
function taskLink(t: { dealId: string | null; companyId: string | null; contactId: string | null }): string {
  if (t.dealId) return `/crm/deals/${t.dealId}`;
  if (t.companyId) return `/crm/companies/${t.companyId}`;
  if (t.contactId) return `/crm/contacts/${t.contactId}`;
  return "/crm/tasks";
}

export async function updateTaskStatus(id: string, status: string) {
  const user = await requireCrmEditor();
  if (!(TASK_STATUSES as readonly string[]).includes(status)) return { error: "Invalid status." };
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return { error: "Task not found." };
  const done = status === "DONE";
  const updated = await prisma.task.update({
    where: { id },
    data: {
      status,
      completedAt: done ? (t.completedAt ?? new Date()) : null,
      completedById: done ? (t.completedById ?? user.id) : null,
    },
  });
  await audit(user.id, "UPDATE", "Task", id, `status → ${status}`);
  await logActivity({
    actorId: user.id, action: done ? "COMPLETED" : "UPDATED", entityType: "TASK", entityId: id,
    summary: done ? `Completed task “${t.title}”` : `Set task “${t.title}” to ${status}`,
    field: "status", previousValue: t.status, newValue: status,
    dealId: updated.dealId, companyId: updated.companyId, contactId: updated.contactId,
  });
  if (done) {
    await notify({ actorId: user.id, userId: t.createdById, type: "TASK_COMPLETED", title: `${user.name} completed a task`, body: t.title, link: taskLink(updated), entityType: "TASK", entityId: id });
  }
  revalidateTaskAnchors(updated);
  return { ok: true };
}

// Checkbox toggle: DONE ⇄ TODO (records/clears completion).
export async function toggleTaskDone(id: string) {
  const user = await requireCrmEditor();
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  const done = t.status !== "DONE";
  const updated = await prisma.task.update({
    where: { id },
    data: {
      status: done ? "DONE" : "TODO",
      completedAt: done ? new Date() : null,
      completedById: done ? user.id : null,
    },
  });
  await audit(user.id, "UPDATE", "Task", id, done ? "completed" : "reopened");
  await logActivity({
    actorId: user.id, action: done ? "COMPLETED" : "REOPENED", entityType: "TASK", entityId: id,
    summary: done ? `Completed task “${t.title}”` : `Reopened task “${t.title}”`,
    dealId: updated.dealId, companyId: updated.companyId, contactId: updated.contactId,
  });
  if (done) {
    await notify({ actorId: user.id, userId: t.createdById, type: "TASK_COMPLETED", title: `${user.name} completed a task`, body: t.title, link: taskLink(updated), entityType: "TASK", entityId: id });
  }
  revalidateTaskAnchors(updated);
}

export async function deleteTask(id: string) {
  const user = await requireCrmEditor();
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  await prisma.task.delete({ where: { id } });
  await audit(user.id, "DELETE", "Task", id, t.title);
  await logActivity({
    actorId: user.id, action: "DELETED", entityType: "TASK", entityId: id,
    summary: `Deleted task “${t.title}”`, dealId: t.dealId, companyId: t.companyId, contactId: t.contactId,
  });
  revalidateTaskAnchors(t);
}

// ===========================================================================
// Notifications (recipient-only read state)
// ===========================================================================
export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}
