"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, logout, assertCanEdit } from "@/lib/auth";
import { majorToMinor } from "@/lib/money";
import {
  RELATIONSHIP_TYPES,
  COMPANY_SOURCES,
  COMPANY_SIZES,
  ACTIVITY_TYPES,
  DEAL_STAGES,
  COMMERCIAL_MODELS,
  CURRENCIES,
  isTerminalStage,
} from "@/lib/constants";

// CRM server actions. Kept separate from the large src/app/actions.ts. Same
// conventions: zod-validate FormData, guard with requireEditor(), write via
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

async function requireEditor() {
  const user = await requireUser();
  assertCanEdit(user.role);
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
  const user = await requireEditor();
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
    revalidatePath("/crm/companies");
    revalidatePath(`/crm/companies/${p.id}`);
    redirect(`/crm/companies/${p.id}`);
  }
  const created = await prisma.company.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Company", created.id, data.name);
  revalidatePath("/crm/companies");
  redirect(`/crm/companies/${created.id}`);
}

export async function toggleCompanyActive(id: string) {
  const user = await requireEditor();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) return;
  await prisma.company.update({ where: { id }, data: { active: !c.active } });
  await audit(user.id, c.active ? "DEACTIVATE" : "ACTIVATE", "Company", id, c.name);
  revalidatePath("/crm/companies");
  revalidatePath(`/crm/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const user = await requireEditor();
  const c = await prisma.company.findUnique({ where: { id } });
  if (!c) return;
  // Contacts and deals are kept (their companyId is set to null via the schema's
  // onDelete: SetNull); activities and documents owned by the company cascade.
  await prisma.company.delete({ where: { id } });
  await audit(user.id, "DELETE", "Company", id, c.name);
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
  const user = await requireEditor();
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
    revalidatePath("/crm/contacts");
    revalidatePath(`/crm/contacts/${p.id}`);
    if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
    redirect(`/crm/contacts/${p.id}`);
  }
  const created = await prisma.contact.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Contact", created.id, label);
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
  const user = await requireEditor();
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
  await prisma.company.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Company", id, field);
  revalidatePath(`/crm/companies/${id}`);
  revalidatePath("/crm/companies");
  return { ok: true };
}

const EDITABLE_CONTACT_FIELDS = [
  "firstName", "lastName", "title", "email", "phone", "companyId", "ownerId", "notes", "isPrimary",
] as const;

export async function updateContactField(id: string, field: string, value: string) {
  const user = await requireEditor();
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
  const before = await prisma.contact.findUnique({ where: { id }, select: { companyId: true } });
  await prisma.contact.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Contact", id, field);
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
  const user = await requireEditor();
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
    revalidatePath("/crm/deals");
    revalidatePath(`/crm/deals/${p.id}`);
    if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
    redirect(`/crm/deals/${p.id}`);
  }
  const created = await prisma.deal.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Deal", created.id, data.title);
  revalidatePath("/crm/deals");
  if (data.companyId) revalidatePath(`/crm/companies/${data.companyId}`);
  redirect(`/crm/deals/${created.id}`);
}

// Quick stage change from the list or record view. Manages closedAt.
export async function updateDealStage(id: string, stage: string) {
  const user = await requireEditor();
  if (!(DEAL_STAGES as readonly string[]).includes(stage)) return { error: "Invalid stage." };
  const before = await prisma.deal.findUnique({ where: { id }, select: { companyId: true, closedAt: true } });
  await prisma.deal.update({
    where: { id },
    data: { stage, closedAt: isTerminalStage(stage) ? (before?.closedAt ?? new Date()) : null },
  });
  await audit(user.id, "UPDATE", "Deal", id, `stage → ${stage}`);
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
  const user = await requireEditor();
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

  const before = await prisma.deal.findUnique({ where: { id }, select: { companyId: true } });
  await prisma.deal.update({ where: { id }, data });
  await audit(user.id, "UPDATE", "Deal", id, field);
  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm/deals");
  if (before?.companyId) revalidatePath(`/crm/companies/${before.companyId}`);
  if (field === "companyId" && data.companyId) revalidatePath(`/crm/companies/${data.companyId as string}`);
  return { ok: true };
}

export async function deleteDeal(id: string) {
  const user = await requireEditor();
  const d = await prisma.deal.findUnique({ where: { id } });
  if (!d) return;
  await prisma.deal.delete({ where: { id } });
  await audit(user.id, "DELETE", "Deal", id, d.title);
  revalidatePath("/crm/deals");
  if (d.companyId) revalidatePath(`/crm/companies/${d.companyId}`);
  redirect("/crm/deals");
}

// ===========================================================================
// Activities (notes / tasks / logged interactions) — the record timeline
// ===========================================================================
export async function addActivity(input: {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  type: string;
  subject: string;
  body?: string;
  dueDate?: string;
}) {
  const user = await requireEditor();
  const type = (ACTIVITY_TYPES as readonly string[]).includes(input.type) ? input.type : "NOTE";
  const subject = (input.subject ?? "").trim();
  if (!subject) return { error: "Add some text first." };
  const isTask = type === "TASK";
  await prisma.activity.create({
    data: {
      type,
      subject: subject.slice(0, 300),
      body: orNull(input.body),
      status: isTask ? "OPEN" : "DONE",
      dueDate: isTask && input.dueDate ? new Date(input.dueDate) : null,
      occurredAt: new Date(),
      companyId: orNull(input.companyId),
      contactId: orNull(input.contactId),
      dealId: orNull(input.dealId),
      ownerId: user.id,
      createdById: user.id,
    },
  });
  await audit(user.id, "CREATE", "Activity", undefined, `${type}: ${subject.slice(0, 60)}`);
  if (input.companyId) revalidatePath(`/crm/companies/${input.companyId}`);
  if (input.contactId) revalidatePath(`/crm/contacts/${input.contactId}`);
  if (input.dealId) revalidatePath(`/crm/deals/${input.dealId}`);
  return { ok: true };
}

export async function toggleActivityDone(id: string) {
  const user = await requireEditor();
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) return;
  const done = a.status !== "DONE";
  await prisma.activity.update({
    where: { id },
    data: { status: done ? "DONE" : "OPEN", completedAt: done ? new Date() : null },
  });
  await audit(user.id, "UPDATE", "Activity", id, done ? "completed" : "reopened");
  if (a.companyId) revalidatePath(`/crm/companies/${a.companyId}`);
  if (a.contactId) revalidatePath(`/crm/contacts/${a.contactId}`);
  if (a.dealId) revalidatePath(`/crm/deals/${a.dealId}`);
}

export async function deleteActivity(id: string) {
  const user = await requireEditor();
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) return;
  await prisma.activity.delete({ where: { id } });
  await audit(user.id, "DELETE", "Activity", id, a.subject.slice(0, 60));
  if (a.companyId) revalidatePath(`/crm/companies/${a.companyId}`);
  if (a.contactId) revalidatePath(`/crm/contacts/${a.contactId}`);
  if (a.dealId) revalidatePath(`/crm/deals/${a.dealId}`);
}

export async function deleteContact(id: string) {
  const user = await requireEditor();
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.contact.delete({ where: { id } });
  await audit(user.id, "DELETE", "Contact", id, `${c.firstName} ${c.lastName}`.trim());
  revalidatePath("/crm/contacts");
  if (c.companyId) revalidatePath(`/crm/companies/${c.companyId}`);
  redirect("/crm/contacts");
}
