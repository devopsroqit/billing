import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// minor-unit helpers
const inr = (r: number) => Math.round(r * 100); // paise
const usd = (d: number) => Math.round(d * 100); // cents
const eur = (e: number) => Math.round(e * 100); // cents
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

async function main() {
  console.log("Seeding roqit Billing (recurring-payment tracker)…");

  // Wipe (order matters due to FKs)
  await prisma.emailOutbox.deleteMany();
  await prisma.document.deleteMany();
  await prisma.paymentEntry.deleteMany();
  await prisma.service.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  // ---- Team members ------------------------------------------------------
  const pwd = await bcrypt.hash("password123", 10);
  const admin = await prisma.user.create({
    data: { email: "admin@roqit.com", name: "Admin", passwordHash: pwd, role: "ADMIN" },
  });
  const editor = await prisma.user.create({
    data: { email: "editor@roqit.com", name: "Prashanth (Finance)", passwordHash: pwd, role: "EDITOR" },
  });
  await prisma.user.create({
    data: { email: "viewer@roqit.com", name: "Viewer", passwordHash: pwd, role: "VIEWER" },
  });

  // ---- Recurring services (the vendors ROQIT pays) -----------------------
  // amounts below are the "default" prefill used when generating a month.
  const services = await Promise.all(
    [
      {
        name: "Flespi", vendorType: "SUBSCRIPTION", billingFrequency: "MONTHLY",
        currency: "USD", dueDayOfMonth: 16, vendorUrl: "https://flespi.com",
        defaultInrPaise: inr(25702.8), defaultUsdCents: usd(269), defaultEurCents: eur(236),
        notes: "IoT telemetry platform. Billed after invoice is generated.",
      },
      {
        name: "GitHub", vendorType: "SUBSCRIPTION", billingFrequency: "MONTHLY",
        currency: "USD", dueDayOfMonth: 23, vendorUrl: "https://github.com",
        defaultInrPaise: inr(2287.4), defaultUsdCents: usd(24), defaultEurCents: eur(21.12),
        notes: "Team seats. Advance payment.",
      },
      {
        name: "MSG91", vendorType: "SERVICE", billingFrequency: "MONTHLY_USAGE",
        currency: "INR", dueDayOfMonth: null, vendorUrl: "https://msg91.com",
        defaultInrPaise: inr(5600), defaultUsdCents: usd(59), defaultEurCents: eur(51.7),
        notes: "SMS/OTP. Varies with volume / downloads.",
      },
      {
        name: "Vercel", vendorType: "SERVICE", billingFrequency: "MONTHLY",
        currency: "USD", dueDayOfMonth: 17, vendorUrl: "https://vercel.com",
        defaultInrPaise: inr(3812), defaultUsdCents: usd(40), defaultEurCents: eur(35.2),
        notes: "Frontend hosting. Advance payment.",
      },
      {
        name: "Airtel M2M", vendorType: "SUBSCRIPTION", billingFrequency: "MONTHLY",
        currency: "INR", dueDayOfMonth: 20, vendorUrl: null,
        defaultInrPaise: inr(1030), defaultUsdCents: usd(11), defaultEurCents: eur(9.5),
        notes: "SIM connectivity. Price assumes 10 SIMs active.",
      },
      {
        name: "AWS", vendorType: "SERVICE", billingFrequency: "MONTHLY_USAGE",
        currency: "USD", dueDayOfMonth: 22, vendorUrl: "https://aws.amazon.com",
        defaultInrPaise: inr(206282.85), defaultUsdCents: usd(2286.59), defaultEurCents: eur(1949.84),
        notes: "Cloud infrastructure. Invoice generated monthly.",
      },
      {
        name: "Twilio", vendorType: "SERVICE", billingFrequency: "PAY_AS_YOU_GO",
        currency: "USD", dueDayOfMonth: null, vendorUrl: "https://twilio.com",
        defaultInrPaise: inr(4486.75), defaultUsdCents: usd(50), defaultEurCents: eur(42.46),
        notes: "Voice/SMS. Pay as you go, depends on usage.",
      },
      {
        name: "Figma", vendorType: "SUBSCRIPTION", billingFrequency: "ANNUAL",
        currency: "USD", dueDayOfMonth: 17, vendorUrl: "https://figma.com",
        defaultInrPaise: inr(17203.2), defaultUsdCents: usd(192), defaultEurCents: eur(163.89),
        notes: "Design tool. Annual plan.",
      },
    ].map((s) => prisma.service.create({ data: s })),
  );

  const byName = Object.fromEntries(services.map((s) => [s.name, s]));

  // ---- Helper to create a month's rows -----------------------------------
  type Row = {
    service: string;
    status: "PENDING" | "PAID" | "OVERDUE";
    paidOn?: Date;
    dueOverride?: Date | null;
    inr: number; usd: number; eur: number;
    paidInr?: number;
    notes?: string;
  };

  async function seedMonth(year: number, month: number, rows: Row[]) {
    for (const r of rows) {
      const svc = byName[r.service];
      const due =
        r.dueOverride !== undefined
          ? r.dueOverride
          : svc.dueDayOfMonth
            ? d(year, month, svc.dueDayOfMonth)
            : null;
      await prisma.paymentEntry.create({
        data: {
          serviceId: svc.id,
          serviceName: svc.name,
          vendorType: svc.vendorType,
          billingFrequency: svc.billingFrequency,
          periodYear: year,
          periodMonth: month,
          dueDate: due,
          paymentMadeOn: r.paidOn ?? null,
          status: r.status,
          amountInrPaise: inr(r.inr),
          amountUsdCents: usd(r.usd),
          amountEurCents: eur(r.eur),
          thisMonthPaidInrPaise: inr(r.paidInr ?? (r.status === "PAID" ? r.inr : 0)),
          notes: r.notes ?? svc.notes,
          createdById: editor.id,
        },
      });
    }
  }

  // June 2026 — fully settled (historical)
  await seedMonth(2026, 6, [
    { service: "Flespi", status: "PAID", paidOn: d(2026, 6, 16), inr: 25702.8, usd: 269, eur: 236 },
    { service: "GitHub", status: "PAID", paidOn: d(2026, 6, 22), inr: 2287.4, usd: 24, eur: 21.12 },
    { service: "MSG91", status: "PAID", paidOn: d(2026, 6, 28), inr: 5210, usd: 55, eur: 48 },
    { service: "Vercel", status: "PAID", paidOn: d(2026, 6, 17), inr: 3812, usd: 40, eur: 35.2 },
    { service: "Airtel M2M", status: "PAID", paidOn: d(2026, 6, 20), inr: 1030, usd: 11, eur: 9.5 },
    { service: "AWS", status: "PAID", paidOn: d(2026, 6, 23), inr: 198450.1, usd: 2200, eur: 1875 },
    { service: "Twilio", status: "PAID", paidOn: d(2026, 6, 12), inr: 4486.75, usd: 50, eur: 42.46 },
  ]);

  // July 2026 — current month: mostly paid, AWS overdue, MSG91 still pending
  await seedMonth(2026, 7, [
    { service: "Flespi", status: "PAID", paidOn: d(2026, 7, 16), inr: 25702.8, usd: 269, eur: 236 },
    { service: "GitHub", status: "PAID", paidOn: d(2026, 7, 23), inr: 2287.4, usd: 24, eur: 21.12 },
    { service: "Vercel", status: "PAID", paidOn: d(2026, 7, 17), inr: 3812, usd: 40, eur: 35.2 },
    { service: "Airtel M2M", status: "PAID", paidOn: d(2026, 7, 20), inr: 1030, usd: 11, eur: 9.5 },
    { service: "AWS", status: "OVERDUE", inr: 206282.85, usd: 2286.59, eur: 1949.84,
      notes: "Invoice generated — payment pending." },
    { service: "MSG91", status: "PENDING", inr: 5600, usd: 59, eur: 51.7 },
    { service: "Twilio", status: "PENDING", inr: 4102, usd: 46, eur: 39 },
  ]);

  // August 2026 — upcoming: all pending (some due soon)
  await seedMonth(2026, 8, [
    { service: "Flespi", status: "PENDING", inr: 25702.8, usd: 269, eur: 236 },
    { service: "GitHub", status: "PENDING", inr: 2287.4, usd: 24, eur: 21.12 },
    { service: "Vercel", status: "PENDING", inr: 3812, usd: 40, eur: 35.2 },
    { service: "Airtel M2M", status: "PENDING", inr: 1030, usd: 11, eur: 9.5 },
    { service: "AWS", status: "PENDING", inr: 210000, usd: 2325, eur: 1980 },
    { service: "MSG91", status: "PENDING", inr: 5600, usd: 59, eur: 51.7 },
  ]);

  // ---- A couple of example documents (link + note) -----------------------
  const paidFlespiJul = await prisma.paymentEntry.findFirst({
    where: { serviceName: "Flespi", periodYear: 2026, periodMonth: 7 },
  });
  const paidGithubJul = await prisma.paymentEntry.findFirst({
    where: { serviceName: "GitHub", periodYear: 2026, periodMonth: 7 },
  });
  if (paidFlespiJul) {
    await prisma.document.create({
      data: {
        entryId: paidFlespiJul.id,
        kind: "LINK",
        title: "Flespi receipt (Jul 2026)",
        externalUrl: "https://drive.google.com/roqit-sharedfolder/flespi-2026-07",
        uploadedById: editor.id,
      },
    });
  }
  if (paidGithubJul) {
    await prisma.document.create({
      data: {
        entryId: paidGithubJul.id,
        kind: "LINK",
        title: "github-AION-TECH-Solutions-LTD-receipt-2026-07.pdf",
        externalUrl: "https://drive.google.com/roqit-sharedfolder/github-2026-07",
        uploadedById: editor.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "SEED", entity: "System", detail: "Initial demo data loaded" },
  });

  console.log("Done. Log in with admin@roqit.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
