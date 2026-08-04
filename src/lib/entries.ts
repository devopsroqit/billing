import { prisma } from "./db";

// Helpers for the monthly payment rows (PaymentEntry) — the heart of the tracker.

/** Return the id only if a matching user exists, else null — keeps the
 *  optional createdById foreign key valid even with a stale/unknown id. */
async function safeCreatorId(id?: string | null): Promise<string | null> {
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  return u ? id : null;
}

/** Build a due date inside a given period from a service's dueDayOfMonth. */
export function dueDateFor(year: number, month: number, dueDay?: number | null): Date | null {
  if (!dueDay) return null;
  // Clamp to the last day of the month (e.g. day 31 in February).
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return new Date(year, month - 1, day);
}

/**
 * Generate this-period rows for every active service that doesn't already have
 * one. Amounts are pre-filled from the service defaults; status starts PENDING.
 * Returns how many rows were created.
 */
export async function generateEntriesForPeriod(
  year: number,
  month: number,
  actorUserId?: string,
): Promise<number> {
  const services = await prisma.service.findMany({ where: { active: true } });
  const creatorId = await safeCreatorId(actorUserId);
  let created = 0;

  for (const s of services) {
    // Annual services only bill once a year — skip auto-generating monthly rows.
    // (Users can still add them manually in the month they fall due.)
    const existing = await prisma.paymentEntry.findFirst({
      where: { serviceId: s.id, periodYear: year, periodMonth: month },
    });
    if (existing) continue;

    await prisma.paymentEntry.create({
      data: {
        serviceId: s.id,
        serviceName: s.name,
        vendorType: s.vendorType,
        billingFrequency: s.billingFrequency,
        periodYear: year,
        periodMonth: month,
        dueDate: dueDateFor(year, month, s.dueDayOfMonth),
        status: "PENDING",
        amountInrPaise: s.defaultInrPaise,
        amountUsdCents: s.defaultUsdCents,
        amountEurCents: s.defaultEurCents,
        createdById: creatorId,
      },
    });
    created++;
  }

  return created;
}

/** The period immediately before the given one. */
export function previousPeriod(year: number, month: number): { year: number; month: number } {
  const dt = new Date(year, month - 2, 1); // month is 1-based; -2 gives previous month's index
  return { year: dt.getFullYear(), month: dt.getMonth() + 1 };
}

/**
 * Copy the previous month's rows into the given period. Amounts and notes carry
 * over; status resets to PENDING, payment fields clear, and each due date rolls
 * forward one month. Rows already present in the target period (same service)
 * are skipped, so it's safe to run more than once. Returns rows created.
 */
export async function duplicatePreviousMonthEntries(
  year: number,
  month: number,
  actorUserId?: string,
): Promise<number> {
  const prev = previousPeriod(year, month);
  const source = await prisma.paymentEntry.findMany({
    where: { periodYear: prev.year, periodMonth: prev.month },
  });
  if (source.length === 0) return 0;

  const existing = await prisma.paymentEntry.findMany({
    where: { periodYear: year, periodMonth: month },
    select: { serviceId: true, serviceName: true },
  });
  const haveServiceId = new Set(existing.filter((e) => e.serviceId).map((e) => e.serviceId));
  const haveName = new Set(existing.map((e) => e.serviceName.toLowerCase()));
  const creatorId = await safeCreatorId(actorUserId);

  let created = 0;
  for (const s of source) {
    // Skip if this service already has a row in the target month.
    if (s.serviceId ? haveServiceId.has(s.serviceId) : haveName.has(s.serviceName.toLowerCase())) {
      continue;
    }
    const rolledDue = s.dueDate ? dueDateFor(year, month, s.dueDate.getDate()) : null;
    await prisma.paymentEntry.create({
      data: {
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        vendorType: s.vendorType,
        billingFrequency: s.billingFrequency,
        periodYear: year,
        periodMonth: month,
        dueDate: rolledDue,
        paymentMadeOn: null,
        status: "PENDING",
        amountInrPaise: s.amountInrPaise,
        amountUsdCents: s.amountUsdCents,
        amountEurCents: s.amountEurCents,
        thisMonthPaidInrPaise: 0,
        notes: s.notes,
        createdById: creatorId,
      },
    });
    created++;
  }
  return created;
}

/** Sum the three currency columns + this-month-paid for a set of rows. */
export function totalsFor(
  entries: {
    amountInrPaise: number;
    amountUsdCents: number;
    amountEurCents: number;
    thisMonthPaidInrPaise: number;
  }[],
) {
  return entries.reduce(
    (acc, e) => ({
      inr: acc.inr + e.amountInrPaise,
      usd: acc.usd + e.amountUsdCents,
      eur: acc.eur + e.amountEurCents,
      paid: acc.paid + e.thisMonthPaidInrPaise,
    }),
    { inr: 0, usd: 0, eur: 0, paid: 0 },
  );
}

/** The list of periods (year+month) that actually have rows, newest first. */
export async function listPeriods(): Promise<{ year: number; month: number }[]> {
  const rows = await prisma.paymentEntry.findMany({
    select: { periodYear: true, periodMonth: true },
    distinct: ["periodYear", "periodMonth"],
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });
  return rows.map((r) => ({ year: r.periodYear, month: r.periodMonth }));
}
