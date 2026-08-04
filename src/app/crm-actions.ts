"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, logout, assertCanEdit } from "@/lib/auth";
import { ACCOUNT_TYPES } from "@/lib/constants";

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

// ===========================================================================
// Accounts
// ===========================================================================
const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(ACCOUNT_TYPES),
  industry: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstin: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function saveAccount(formData: FormData) {
  const user = await requireEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = accountSchema.parse(raw);
  const data = {
    name: p.name.trim(),
    type: p.type,
    industry: orNull(p.industry),
    website: orNull(p.website),
    email: orNull(p.email),
    phone: orNull(p.phone),
    address: orNull(p.address),
    gstin: orNull(p.gstin),
    notes: orNull(p.notes),
    ownerId: orNull(p.ownerId),
  };

  if (p.id) {
    await prisma.account.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Account", p.id, data.name);
    revalidatePath("/crm/accounts");
    revalidatePath(`/crm/accounts/${p.id}`);
    redirect(`/crm/accounts/${p.id}`);
  }
  const created = await prisma.account.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Account", created.id, data.name);
  revalidatePath("/crm/accounts");
  redirect(`/crm/accounts/${created.id}`);
}

export async function toggleAccountActive(id: string) {
  const user = await requireEditor();
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a) return;
  await prisma.account.update({ where: { id }, data: { active: !a.active } });
  await audit(user.id, a.active ? "DEACTIVATE" : "ACTIVATE", "Account", id, a.name);
  revalidatePath("/crm/accounts");
  revalidatePath(`/crm/accounts/${id}`);
}

export async function deleteAccount(id: string) {
  const user = await requireEditor();
  const a = await prisma.account.findUnique({ where: { id } });
  if (!a) return;
  // Contacts and deals are kept (their accountId is set to null via the schema's
  // onDelete: SetNull); activities and documents owned by the account cascade.
  await prisma.account.delete({ where: { id } });
  await audit(user.id, "DELETE", "Account", id, a.name);
  revalidatePath("/crm/accounts");
  redirect("/crm/accounts");
}

// ===========================================================================
// Contacts
// ===========================================================================
const contactSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().optional(),
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
    accountId: orNull(p.accountId),
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
    if (data.accountId) revalidatePath(`/crm/accounts/${data.accountId}`);
    redirect(`/crm/contacts/${p.id}`);
  }
  const created = await prisma.contact.create({ data: { ...data, createdById: user.id } });
  await audit(user.id, "CREATE", "Contact", created.id, label);
  revalidatePath("/crm/contacts");
  if (data.accountId) revalidatePath(`/crm/accounts/${data.accountId}`);
  redirect(`/crm/contacts/${created.id}`);
}

export async function deleteContact(id: string) {
  const user = await requireEditor();
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.contact.delete({ where: { id } });
  await audit(user.id, "DELETE", "Contact", id, `${c.firstName} ${c.lastName}`.trim());
  revalidatePath("/crm/contacts");
  if (c.accountId) revalidatePath(`/crm/accounts/${c.accountId}`);
  redirect("/crm/contacts");
}
