"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  logout,
  canEdit,
  assertCanEdit,
  assertCanManageUsers,
  hashPassword,
} from "@/lib/auth";
import { majorToMinor } from "@/lib/money";
import { generateEntriesForPeriod, duplicatePreviousMonthEntries } from "@/lib/entries";
import { runAlerts } from "@/lib/alerts";
import { flushOutbox, sendWelcomeEmail } from "@/lib/email";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import ExcelJS from "exceljs";

async function requireUser() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  // The session lives in a signed cookie. Make sure the user still exists and is
  // active — after the DB is re-seeded, IDs regenerate and an old cookie would
  // point at a deleted user, which breaks foreign-key writes. Force a re-login.
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

function trackerPath(year: number, month: number) {
  return `/tracker?y=${year}&m=${month}`;
}

// --------------------------------------------------------------------------
// Services (recurring vendor definitions)
// --------------------------------------------------------------------------
const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  vendorType: z.enum(["SUBSCRIPTION", "SERVICE"]),
  billingFrequency: z.enum(["MONTHLY", "ANNUAL", "MONTHLY_USAGE", "PAY_AS_YOU_GO", "ONE_TIME"]),
  currency: z.enum(["INR", "USD", "EUR"]),
  // Blank means "no fixed due day". Treat "" / null as undefined so the
  // optional passes, instead of coercing "" → 0 and failing .min(1).
  dueDayOfMonth: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1).max(31).optional(),
  ),
  defaultInr: z.coerce.number().min(0).default(0),
  defaultUsd: z.coerce.number().min(0).default(0),
  defaultEur: z.coerce.number().min(0).default(0),
  vendorUrl: z.string().optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export async function saveService(formData: FormData) {
  const user = await requireEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = serviceSchema.parse({ ...raw, active: raw.active === "on" || raw.active === "true" });

  const data = {
    name: parsed.name.trim(),
    vendorType: parsed.vendorType,
    billingFrequency: parsed.billingFrequency,
    currency: parsed.currency,
    dueDayOfMonth: Number.isFinite(parsed.dueDayOfMonth) ? parsed.dueDayOfMonth : null,
    defaultInrPaise: majorToMinor(parsed.defaultInr),
    defaultUsdCents: majorToMinor(parsed.defaultUsd),
    defaultEurCents: majorToMinor(parsed.defaultEur),
    vendorUrl: parsed.vendorUrl?.trim() || null,
    notes: parsed.notes?.trim() || null,
    active: parsed.active ?? true,
  };

  if (parsed.id) {
    await prisma.service.update({ where: { id: parsed.id }, data });
    await audit(user.id, "UPDATE", "Service", parsed.id, data.name);
  } else {
    const created = await prisma.service.create({ data });
    await audit(user.id, "CREATE", "Service", created.id, data.name);
  }
  revalidatePath("/services");
  redirect("/services");
}

export async function toggleServiceActive(id: string) {
  const user = await requireEditor();
  const svc = await prisma.service.findUnique({ where: { id } });
  if (!svc) throw new Error("Service not found");
  await prisma.service.update({ where: { id }, data: { active: !svc.active } });
  await audit(user.id, svc.active ? "DEACTIVATE" : "ACTIVATE", "Service", id, svc.name);
  revalidatePath("/services");
}

// --------------------------------------------------------------------------
// Payment entries (the monthly rows)
// --------------------------------------------------------------------------
const entrySchema = z.object({
  id: z.string().optional(),
  serviceId: z.string().optional(),
  serviceName: z.string().min(1, "Service is required"),
  vendorType: z.enum(["SUBSCRIPTION", "SERVICE"]),
  billingFrequency: z.enum(["MONTHLY", "ANNUAL", "MONTHLY_USAGE", "PAY_AS_YOU_GO", "ONE_TIME"]),
  periodYear: z.coerce.number().int(),
  periodMonth: z.coerce.number().int().min(1).max(12),
  status: z.enum(["PENDING", "PAID", "OVERDUE"]),
  dueDate: z.string().optional(),
  paymentMadeOn: z.string().optional(),
  amountInr: z.coerce.number().min(0).default(0),
  amountUsd: z.coerce.number().min(0).default(0),
  amountEur: z.coerce.number().min(0).default(0),
  thisMonthPaidInr: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

export async function saveEntry(formData: FormData) {
  const user = await requireEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = entrySchema.parse(raw);

  const data = {
    serviceId: p.serviceId || null,
    serviceName: p.serviceName.trim(),
    vendorType: p.vendorType,
    billingFrequency: p.billingFrequency,
    periodYear: p.periodYear,
    periodMonth: p.periodMonth,
    status: p.status,
    dueDate: parseDate(p.dueDate),
    paymentMadeOn: parseDate(p.paymentMadeOn),
    amountInrPaise: majorToMinor(p.amountInr),
    amountUsdCents: majorToMinor(p.amountUsd),
    amountEurCents: majorToMinor(p.amountEur),
    thisMonthPaidInrPaise: majorToMinor(p.thisMonthPaidInr),
    notes: p.notes?.trim() || null,
  };

  if (p.id) {
    await prisma.paymentEntry.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "PaymentEntry", p.id, `${data.serviceName} ${p.periodMonth}/${p.periodYear}`);
  } else {
    const created = await prisma.paymentEntry.create({ data: { ...data, createdById: user.id } });
    await audit(user.id, "CREATE", "PaymentEntry", created.id, `${data.serviceName} ${p.periodMonth}/${p.periodYear}`);
  }
  revalidatePath(trackerPath(p.periodYear, p.periodMonth));
  redirect(trackerPath(p.periodYear, p.periodMonth));
}

/** Quick "mark paid" — sets status PAID, paidOn today, and this-month-paid to the INR amount. */
export async function markPaid(id: string) {
  const user = await requireEditor();
  const entry = await prisma.paymentEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Row not found");
  await prisma.paymentEntry.update({
    where: { id },
    data: {
      status: "PAID",
      paymentMadeOn: new Date(),
      thisMonthPaidInrPaise: entry.thisMonthPaidInrPaise || entry.amountInrPaise,
    },
  });
  await audit(user.id, "MARK_PAID", "PaymentEntry", id, entry.serviceName);
  revalidatePath(trackerPath(entry.periodYear, entry.periodMonth));
}

export async function markPending(id: string) {
  const user = await requireEditor();
  const entry = await prisma.paymentEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Row not found");
  await prisma.paymentEntry.update({
    where: { id },
    data: { status: "PENDING", paymentMadeOn: null, thisMonthPaidInrPaise: 0 },
  });
  await audit(user.id, "MARK_PENDING", "PaymentEntry", id, entry.serviceName);
  revalidatePath(trackerPath(entry.periodYear, entry.periodMonth));
}

export async function deleteEntry(id: string) {
  const user = await requireEditor();
  const entry = await prisma.paymentEntry.findUnique({ where: { id } });
  if (!entry) return;
  await prisma.paymentEntry.delete({ where: { id } });
  await audit(user.id, "DELETE", "PaymentEntry", id, entry.serviceName);
  revalidatePath(trackerPath(entry.periodYear, entry.periodMonth));
}

/** Generate this-period rows from active services. Returns via redirect. */
export async function generateMonth(formData: FormData) {
  await requireEditor();
  const user = await getSessionUser();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const created = await generateEntriesForPeriod(year, month, user?.id);
  if (user) await audit(user.id, "GENERATE_MONTH", "PaymentEntry", undefined, `${created} rows for ${month}/${year}`);
  revalidatePath(trackerPath(year, month));
  redirect(trackerPath(year, month));
}

/** Copy the previous month's rows into this period (status reset to pending). */
export async function duplicatePreviousMonth(formData: FormData) {
  await requireEditor();
  const user = await getSessionUser();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const created = await duplicatePreviousMonthEntries(year, month, user?.id);
  if (user) await audit(user.id, "DUPLICATE_MONTH", "PaymentEntry", undefined, `${created} rows into ${month}/${year}`);
  revalidatePath(trackerPath(year, month));
  redirect(trackerPath(year, month));
}

// --------------------------------------------------------------------------
// Documents (invoices / receipts)
// --------------------------------------------------------------------------
// Resolve which owner a document form targets. Exactly one of entryId /
// purchaseId / deviceId is expected; returns the owner data + revalidate path.
async function resolveDocOwner(
  formData: FormData,
): Promise<{ owner: { entryId?: string; purchaseId?: string; deviceId?: string }; revalidate: string; entity: string; id: string } | { error: string }> {
  const entryId = String(formData.get("entryId") || "");
  const purchaseId = String(formData.get("purchaseId") || "");
  const deviceId = String(formData.get("deviceId") || "");
  if (entryId) {
    const entry = await prisma.paymentEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { error: "Payment row not found." };
    return { owner: { entryId }, revalidate: trackerPath(entry.periodYear, entry.periodMonth), entity: "PaymentEntry", id: entryId };
  }
  if (purchaseId) {
    const p = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!p) return { error: "Purchase not found." };
    return { owner: { purchaseId }, revalidate: `/purchases/${purchaseId}`, entity: "Purchase", id: purchaseId };
  }
  if (deviceId) {
    const d = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!d) return { error: "Device not found." };
    return { owner: { deviceId }, revalidate: `/devices/${deviceId}`, entity: "Device", id: deviceId };
  }
  return { error: "No owner specified for the document." };
}

// Returns a result object (rather than throwing) so the form can show a clear
// message instead of Next's opaque server-side-exception page.
export async function addDocument(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const user = await requireEditor(); // may redirect if logged out — fine, outside try
  try {
    const resolved = await resolveDocOwner(formData);
    if ("error" in resolved) return { error: resolved.error };
    const { owner, revalidate, entity, id } = resolved;

    const kind = String(formData.get("kind") || "FILE");
    const title = String(formData.get("title") || "").trim();

    if (kind === "LINK") {
      const url = String(formData.get("externalUrl") || "").trim();
      if (!url) return { error: "Please provide a link." };
      await prisma.document.create({
        data: { ...owner, kind: "LINK", title: title || url, externalUrl: url, uploadedById: user.id },
      });
    } else {
      const file = formData.get("file") as File | null;
      if (!file || file.size === 0) return { error: "Please choose a file to upload." };
      const MAX = 10 * 1024 * 1024;
      if (file.size > MAX) return { error: "File is too large (max 10 MB)." };
      const bytes = Buffer.from(await file.arrayBuffer());
      await prisma.document.create({
        data: {
          ...owner,
          kind: "FILE",
          title: title || file.name,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          uploadedById: user.id,
          blob: { create: { data: bytes } },
        },
      });
    }
    await audit(user.id, "ADD_DOCUMENT", entity, id, title);
    revalidatePath(revalidate);
    revalidatePath("/documents");
    return { ok: true };
  } catch (e) {
    console.error("addDocument failed:", e);
    return { error: e instanceof Error ? e.message : "Upload failed. Please try again." };
  }
}

export async function deleteDocument(id: string) {
  const user = await requireEditor();
  const doc = await prisma.document.findUnique({ where: { id }, include: { entry: true } });
  if (!doc) return;
  // The DocumentBlob (file bytes) is removed automatically via onDelete: Cascade.
  await prisma.document.delete({ where: { id } });
  await audit(user.id, "DELETE_DOCUMENT", "Document", id, doc.title);
  if (doc.entry) revalidatePath(trackerPath(doc.entry.periodYear, doc.entry.periodMonth));
  if (doc.purchaseId) revalidatePath(`/purchases/${doc.purchaseId}`);
  if (doc.deviceId) revalidatePath(`/devices/${doc.deviceId}`);
  revalidatePath("/documents");
}

// --------------------------------------------------------------------------
// Team members (admin only)
// --------------------------------------------------------------------------
const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  password: z.string().optional(),
});

export async function saveUser(formData: FormData) {
  const actor = await requireUser();
  assertCanManageUsers(actor.role);
  const p = userSchema.parse(Object.fromEntries(formData));
  const email = p.email.toLowerCase().trim();

  if (p.id) {
    const data: Record<string, unknown> = { name: p.name.trim(), email, role: p.role };
    if (p.password && p.password.length >= 6) data.passwordHash = await hashPassword(p.password);
    await prisma.user.update({ where: { id: p.id }, data });
    await audit(actor.id, "UPDATE", "User", p.id, email);
  } else {
    if (!p.password || p.password.length < 6) throw new Error("Password must be at least 6 characters.");
    const created = await prisma.user.create({
      data: { name: p.name.trim(), email, role: p.role, passwordHash: await hashPassword(p.password) },
    });
    await audit(actor.id, "CREATE", "User", created.id, email);
    // Notify the new member. Best-effort — never block account creation on email.
    try {
      await sendWelcomeEmail({
        toEmail: email,
        toName: p.name.trim(),
        roleLabel: ROLE_LABELS[p.role as Role] ?? p.role,
        tempPassword: p.password,
      });
    } catch (e) {
      console.error("welcome email failed:", e);
    }
  }
  revalidatePath("/team");
  redirect("/team");
}

export async function toggleUserActive(id: string) {
  const actor = await requireUser();
  assertCanManageUsers(actor.role);
  if (id === actor.id) throw new Error("You can't deactivate your own account.");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return;
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  await audit(actor.id, u.active ? "DEACTIVATE" : "ACTIVATE", "User", id, u.email);
  revalidatePath("/team");
}

// --------------------------------------------------------------------------
// Alerts
// --------------------------------------------------------------------------
export async function runAlertsAction() {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("Only editors/admins can run alerts.");
  const r = await runAlerts();
  await audit(user.id, "RUN_ALERTS", "System", undefined, JSON.stringify(r));
  revalidatePath("/alerts");
  return {
    message: `Marked ${r.markedOverdue} overdue · queued ${r.dueSoonQueued} due-soon + ${r.overdueQueued} overdue reminders.`,
  };
}

export async function flushOutboxAction() {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("Only editors/admins can send email.");
  const r = await flushOutbox();
  await audit(user.id, "FLUSH_OUTBOX", "System", undefined, JSON.stringify(r));
  revalidatePath("/alerts");
  return { message: `Sent ${r.sent} email(s)${r.failed ? `, ${r.failed} failed` : ""}.` };
}

// ==========================================================================
// Assets & Procurement
// ==========================================================================

// --- Suppliers / OEMs ------------------------------------------------------
const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["OEM", "DISTRIBUTOR", "OTHER"]),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

export async function saveSupplier(formData: FormData) {
  const user = await requireEditor();
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const p = supplierSchema.parse({ ...raw, active: raw.active === "on" || raw.active === "true" });
  const data = {
    name: p.name.trim(),
    type: p.type,
    contactName: p.contactName?.trim() || null,
    contactEmail: p.contactEmail?.trim() || null,
    phone: p.phone?.trim() || null,
    gstin: p.gstin?.trim() || null,
    address: p.address?.trim() || null,
    website: p.website?.trim() || null,
    notes: p.notes?.trim() || null,
    active: p.active ?? true,
  };
  if (p.id) {
    await prisma.supplier.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Supplier", p.id, data.name);
  } else {
    const c = await prisma.supplier.create({ data });
    await audit(user.id, "CREATE", "Supplier", c.id, data.name);
  }
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function toggleSupplierActive(id: string) {
  const user = await requireEditor();
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) return;
  await prisma.supplier.update({ where: { id }, data: { active: !s.active } });
  await audit(user.id, s.active ? "DEACTIVATE" : "ACTIVATE", "Supplier", id, s.name);
  revalidatePath("/suppliers");
}

export async function deleteSupplier(id: string) {
  const user = await requireEditor();
  const s = await prisma.supplier.findUnique({ where: { id } });
  if (!s) return;
  // Purchases and devices that referenced this supplier are kept — their
  // supplierId is set to null automatically (onDelete: SetNull in the schema),
  // so no history is lost.
  await prisma.supplier.delete({ where: { id } });
  await audit(user.id, "DELETE", "Supplier", id, s.name);
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

// --- Purchases -------------------------------------------------------------
const purchaseSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  reference: z.string().optional(),
  currency: z.enum(["INR", "USD", "EUR"]),
  amount: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().int().min(0).default(1),
  notes: z.string().optional(),
});

export async function savePurchase(formData: FormData) {
  const user = await requireEditor();
  const p = purchaseSchema.parse(Object.fromEntries(formData));
  const data = {
    supplierId: p.supplierId || null,
    purchaseDate: parseDate(p.purchaseDate) ?? new Date(),
    reference: p.reference?.trim() || null,
    currency: p.currency,
    amountMinor: majorToMinor(p.amount),
    quantity: p.quantity,
    notes: p.notes?.trim() || null,
  };
  let id = p.id;
  if (p.id) {
    await prisma.purchase.update({ where: { id: p.id }, data });
    await audit(user.id, "UPDATE", "Purchase", p.id, data.reference ?? "");
  } else {
    const c = await prisma.purchase.create({ data: { ...data, createdById: user.id } });
    id = c.id;
    await audit(user.id, "CREATE", "Purchase", c.id, data.reference ?? "");
  }
  revalidatePath("/purchases");
  redirect(`/purchases/${id}`);
}

export async function deletePurchase(id: string) {
  const user = await requireEditor();
  const p = await prisma.purchase.findUnique({ where: { id } });
  if (!p) return;
  await prisma.purchase.delete({ where: { id } });
  await audit(user.id, "DELETE", "Purchase", id, p.reference ?? "");
  revalidatePath("/purchases");
  redirect("/purchases");
}

// --- Devices ---------------------------------------------------------------
const deviceSchema = z.object({
  id: z.string().optional(),
  purchaseId: z.string().optional(),
  supplierId: z.string().optional(),
  assetTag: z.string().optional(), // "Device ID"
  deviceName: z.string().optional(),
  modelNo: z.string().optional(),
  serialImei: z.string().optional(),
  qtyPurchased: z.coerce.number().int().min(0).default(1),
  vendorName: z.string().optional(),
  invoiceNo: z.string().optional(),
  cost: z.coerce.number().min(0).default(0),
  currency: z.enum(["INR", "USD", "EUR"]),
  purchaseDate: z.string().optional(),
  assignedTo: z.string().optional(),
  projectClient: z.string().optional(),
  location: z.string().optional(),
  statusText: z.string().optional(),
  installedStatus: z.string().optional(),
  installedBy: z.string().optional(),
  status: z.enum(["IN_STOCK", "DEPLOYED", "FAULTY", "IN_REPAIR", "RETURNED", "RETIRED"]),
  notes: z.string().optional(),
});

export async function saveDevice(formData: FormData): Promise<{ ok?: true; error?: string }> {
  const user = await requireEditor();
  const p = deviceSchema.parse(Object.fromEntries(formData));
  const deviceName = p.deviceName?.trim() || null;
  const serialImei = p.serialImei?.trim() || null;
  const data = {
    purchaseId: p.purchaseId || null,
    supplierId: p.supplierId || null,
    category: "Device",
    assetTag: p.assetTag?.trim() || null,
    deviceName,
    modelNo: p.modelNo?.trim() || null,
    serialImei,
    qtyPurchased: p.qtyPurchased || 1,
    vendorName: p.vendorName?.trim() || null,
    invoiceNo: p.invoiceNo?.trim() || null,
    // Keep the legacy fields in sync so existing search/detail keep working.
    model: deviceName || p.modelNo?.trim() || null,
    imei: serialImei,
    costMinor: majorToMinor(p.cost),
    currency: p.currency,
    purchaseDate: parseDate(p.purchaseDate),
    assignedTo: p.assignedTo?.trim() || null,
    projectClient: p.projectClient?.trim() || null,
    location: p.location?.trim() || null,
    statusText: p.statusText?.trim() || null,
    installedStatus: p.installedStatus?.trim() || null,
    installedBy: p.installedBy?.trim() || null,
    status: p.status,
    notes: p.notes?.trim() || null,
  };
  try {
    if (p.id) {
      await prisma.device.update({ where: { id: p.id }, data });
      await audit(user.id, "UPDATE", "Device", p.id, data.assetTag ?? data.deviceName ?? data.model ?? "device");
    } else {
      const c = await prisma.device.create({ data: { ...data, createdById: user.id } });
      await audit(user.id, "CREATE", "Device", c.id, data.assetTag ?? data.deviceName ?? data.model ?? "device");
    }
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return { error: "A device with this identifier already exists." };
    }
    throw e;
  }
  revalidatePath("/devices");
  redirect("/devices");
}

export async function changeDeviceStatus(id: string, status: string) {
  const user = await requireEditor();
  const d = await prisma.device.findUnique({ where: { id } });
  if (!d) return;
  await prisma.device.update({ where: { id }, data: { status } });
  await audit(user.id, "CHANGE_STATUS", "Device", id, status);
  revalidatePath(`/devices/${id}`);
  revalidatePath("/devices");
}

export async function deleteDevice(id: string) {
  const user = await requireEditor();
  const d = await prisma.device.findUnique({ where: { id } });
  if (!d) return;
  await prisma.device.delete({ where: { id } });
  await audit(user.id, "DELETE", "Device", id, d.serialNo ?? d.model ?? "");
  revalidatePath("/devices");
  redirect("/devices");
}

// --- Deployment (assignment / movement) ------------------------------------
const deploymentSchema = z.object({
  deviceId: z.string(),
  action: z.enum(["DEPLOYED", "RETURNED", "TRANSFERRED", "REPAIR"]),
  site: z.string().optional(),
  customer: z.string().optional(),
  assignedTo: z.string().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function addDeployment(formData: FormData) {
  const user = await requireEditor();
  const p = deploymentSchema.parse(Object.fromEntries(formData));
  const device = await prisma.device.findUnique({ where: { id: p.deviceId } });
  if (!device) throw new Error("Device not found");

  // Close any still-open deployment so history stays tidy.
  await prisma.deployment.updateMany({
    where: { deviceId: p.deviceId, endDate: null },
    data: { endDate: new Date() },
  });

  await prisma.deployment.create({
    data: {
      deviceId: p.deviceId,
      action: p.action,
      site: p.site?.trim() || null,
      customer: p.customer?.trim() || null,
      assignedTo: p.assignedTo?.trim() || null,
      startDate: parseDate(p.startDate) ?? new Date(),
      notes: p.notes?.trim() || null,
      createdById: user.id,
    },
  });

  // Update the device's current snapshot from the action.
  let status = device.status;
  let location = device.location;
  let assignedTo = device.assignedTo;
  if (p.action === "DEPLOYED" || p.action === "TRANSFERRED") {
    status = "DEPLOYED";
    location = p.site?.trim() || p.customer?.trim() || location;
    assignedTo = p.assignedTo?.trim() || assignedTo;
  } else if (p.action === "RETURNED") {
    status = "IN_STOCK";
    location = null;
    assignedTo = null;
  } else if (p.action === "REPAIR") {
    status = "IN_REPAIR";
  }
  await prisma.device.update({ where: { id: p.deviceId }, data: { status, location, assignedTo } });
  await audit(user.id, "DEPLOYMENT", "Device", p.deviceId, p.action);
  revalidatePath(`/devices/${p.deviceId}`);
  revalidatePath("/devices");
  redirect(`/devices/${p.deviceId}`);
}

// --- Bulk device import (Excel) --------------------------------------------
// Column headers accepted in the uploaded sheet, matched case-insensitively and
// ignoring spaces/punctuation. Extra columns are ignored; column order is free.
const COLS: Record<string, string> = {
  date: "date",
  deviceid: "deviceId",
  devicename: "deviceName",
  modelno: "modelNo",
  serialnoimei: "serialImei",
  serialno: "serialImei",
  serial: "serialImei",
  imei: "serialImei",
  qtypurchased: "qty",
  qty: "qty",
  quantity: "qty",
  vendorname: "vendor",
  vendor: "vendor",
  supplier: "vendor",
  invoiceno: "invoice",
  invoice: "invoice",
  purchasecost: "cost",
  cost: "cost",
  assignedto: "assignedTo",
  projectclient: "project",
  project: "project",
  client: "project",
  location: "location",
  status: "statusText",
  installedstatus: "installedStatus",
  installed: "installedStatus",
  installedby: "installedBy",
  remarks: "remarks",
  notes: "remarks",
};

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseSheetDate(cell: ExcelJS.Cell): Date | null {
  const v = cell.value;
  if (v instanceof Date) return v;
  const t = cell.text?.trim();
  if (!t) return null;
  // Accept dd/mm/yyyy or dd-mm-yyyy (their register format).
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? null : dt;
}

export type BulkImportResult = {
  ok?: true;
  error?: string;
  created?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
};

// Parse an uploaded .xlsx of the shared inventory template and create one
// device per data row. Never throws to the UI — returns a per-row report.
export async function bulkUploadDevices(formData: FormData): Promise<BulkImportResult> {
  const user = await requireEditor();
  try {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Please choose an Excel file to upload." };
    if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10 MB)." };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return { error: "The workbook has no sheets." };

    // Locate the header row (first row that has a Device ID / Device Name / Serial column).
    let headerRowNo = 0;
    const colMap: Record<string, number> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
      const row = ws.getRow(r);
      const found: Record<string, number> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const key = COLS[normHeader(String(cell.text || ""))];
        if (key && !found[key]) found[key] = col;
      });
      if (found.deviceId || found.deviceName || found.serialImei) {
        headerRowNo = r;
        Object.assign(colMap, found);
        break;
      }
    }
    if (!headerRowNo) {
      return { error: "Couldn't find the header row. Use the provided template (needs a Device Name or Serial No / IMEI column)." };
    }

    const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
    const supplierByName = new Map(suppliers.map((s) => [s.name.trim().toLowerCase(), s.id]));

    // Existing asset tags — used to skip rows already imported (safe re-upload).
    const existing = await prisma.device.findMany({ where: { assetTag: { not: null } }, select: { assetTag: true } });
    const seenTags = new Set(existing.map((d) => (d.assetTag || "").trim().toLowerCase()).filter(Boolean));

    const cellText = (row: ExcelJS.Row, key: string) => {
      const col = colMap[key];
      return col ? String(row.getCell(col).text || "").trim() : "";
    };

    let created = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (let r = headerRowNo + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const deviceName = cellText(row, "deviceName");
      const deviceId = cellText(row, "deviceId");
      const serialImei = cellText(row, "serialImei");
      const modelNo = cellText(row, "modelNo");
      // Skip fully-empty rows.
      if (!deviceName && !deviceId && !serialImei && !modelNo) continue;

      const tagKey = deviceId.toLowerCase();
      if (deviceId && seenTags.has(tagKey)) {
        skipped++;
        continue;
      }

      try {
        const vendor = cellText(row, "vendor");
        const invoice = cellText(row, "invoice");
        const qty = cellText(row, "qty");
        const project = cellText(row, "project");
        const statusText = cellText(row, "statusText");
        const installedStatus = cellText(row, "installedStatus");
        const installedBy = cellText(row, "installedBy");
        const remarks = cellText(row, "remarks");

        const costNum = parseFloat(cellText(row, "cost").replace(/[^0-9.]/g, "")) || 0;
        const dateCol = colMap["date"];
        const purchaseDate = dateCol ? parseSheetDate(row.getCell(dateCol)) : null;

        const installed = /^(y|yes|true|installed|custody|deployed)/i.test(installedStatus);
        const status = installed ? "DEPLOYED" : "IN_STOCK";

        const supplierId = vendor ? supplierByName.get(vendor.toLowerCase()) ?? null : null;

        await prisma.device.create({
          data: {
            category: "Device",
            assetTag: deviceId || null,
            deviceName: deviceName || null,
            modelNo: modelNo || null,
            // Their "Serial No / IMEI" values repeat across rows, so this is not
            // the unique serialNo field — it's stored as-is here (and mirrored to
            // imei for search) to avoid false uniqueness clashes.
            serialImei: serialImei || null,
            imei: serialImei || null,
            model: deviceName || modelNo || null,
            qtyPurchased: parseInt(qty, 10) || 1,
            vendorName: vendor || null,
            invoiceNo: invoice || null,
            projectClient: project || null,
            installedStatus: installedStatus || null,
            installedBy: installedBy || null,
            statusText: statusText || null,
            supplierId,
            costMinor: majorToMinor(costNum),
            currency: "INR",
            purchaseDate,
            location: cellText(row, "location") || null,
            assignedTo: cellText(row, "assignedTo") || null,
            status,
            notes: remarks || null,
            createdById: user.id,
          },
        });
        if (deviceId) seenTags.add(tagKey);
        created++;
      } catch (e) {
        errors.push({ row: r, message: e instanceof Error ? e.message : "Failed to import row." });
      }
    }

    await audit(user.id, "BULK_IMPORT", "Device", undefined, `created ${created}, skipped ${skipped}, errors ${errors.length}`);
    revalidatePath("/devices");
    return { ok: true, created, skipped, errors };
  } catch (e) {
    console.error("bulkUploadDevices failed:", e);
    return { error: e instanceof Error ? e.message : "Could not read the file. Make sure it's a valid .xlsx." };
  }
}
