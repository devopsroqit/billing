# roqit Billing — recurring-payment tracker

One internal app to track every **vendor/service ROQIT pays** each month —
GitHub, AWS, Flespi, Twilio, Vercel, and the rest — replacing the
`ROQIT_Recurring_Payment_Tracker` spreadsheet with something multiple office
members can use safely, together.

It records each payment (in **INR, USD and EUR**), tracks **due dates** and
**status** (Pending / Paid / Overdue), keeps every **invoice/receipt** attached
and searchable in one place, and automatically emails the team **"due soon"**
and **"overdue"** reminders. Everything is organized **month-on-month**, just
like the spreadsheet's monthly tabs.

> This is a **record-keeping tracker**, not a payment gateway. No money moves
> through the app. Your team records what happened elsewhere (invoice received,
> payment made) and the app keeps it organized, chases deadlines, and stores the
> documents. Email is **simulated** for now and is designed to be swapped for a
> real provider later.

---

## What it does

| Area | What you can do |
|------|-----------------|
| **Dashboard** | Billed / paid / outstanding this month, overdue count, a 6-month "paid" chart, and a "needs attention" list of upcoming & overdue payments. |
| **Monthly Tracker** | The spreadsheet, reimagined: one row per service per month — Service, Type, Frequency, Due date, Paid-on, Status, **INR / USD / EUR** amounts, This-Month-Paid, Notes, and attached documents. Month tabs across the top and a totals row at the bottom. Mark paid, edit, or delete inline. |
| **Services** | Define each recurring vendor once (type, frequency, currency, due day, default amounts). Then **"Generate month"** creates that month's rows automatically — no re-typing. |
| **Documents** | Every invoice & receipt, **searchable and filterable** by service and month — the "easy way of knowing the documents". Upload a file or paste a Google Drive link. |
| **Alerts & Email** | The engine flags overdue rows and emails the team a reminder N days before a due date and again when overdue. All emails land in a visible outbox. |
| **Team** | Admins add office members and set their access. |

## Access roles

| Role | Can do |
|------|--------|
| **Admin** | Everything, plus manage team members. |
| **Editor** | Add/edit payment rows, mark paid, upload documents, manage services. |
| **Viewer** | Read-only — view everything and download documents, but can't change anything. |

## Tech

- **Next.js 14** (App Router, TypeScript) — one app, frontend + backend together
- **Prisma + PostgreSQL** — use a free managed Postgres (Neon/Supabase); one shared database for the whole team
- **Tailwind CSS**
- Cookie-based session auth (`jose` + `bcryptjs`)
- Documents: upload files (stored in Postgres, so they persist on serverless hosts) or paste external links

## Getting started

You need a PostgreSQL database. The easiest is a free **Neon** (https://neon.tech)
or **Supabase** project — create one and copy its connection string.

```bash
npm install
cp .env.example .env      # then set DATABASE_URL (Postgres) and AUTH_SECRET
npm run setup             # generate client + create tables + seed demo data
npm run dev               # http://localhost:3000
```

> On Windows PowerShell, use `copy .env.example .env` instead of `cp`.
>
> **To put it online for the whole office, see [DEPLOYMENT.md](./DEPLOYMENT.md)** —
> a step-by-step Neon + Vercel guide.

### Demo logins (created by the seed)

| Email | Password | Role |
|-------|----------|------|
| `admin@roqit.com` | `password123` | Admin |
| `editor@roqit.com` | `password123` | Editor |
| `viewer@roqit.com` | `password123` | Viewer |

The seed loads the real ROQIT services and three months of data (June paid,
July current with an overdue AWS row, August upcoming) so every screen is
populated on first run.

## Running the reminder engine

On demand from the **Alerts** page, or headless on a schedule:

```bash
npm run alerts:run        # flag overdue, queue reminders, "send" the outbox
```

Or hit the HTTP endpoint from any external scheduler (cron, GitHub Action, Vercel Cron):

```
GET /api/cron/run-alerts?key=<CRON_SECRET>
```

Set `CRON_SECRET` in the environment to require the key (leave unset for local dev).
Tune how early reminders go out with `ALERT_DUE_SOON_DAYS` (default 5).

## Useful scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | Generate Prisma client, create DB, seed |
| `npm run db:reset` | Wipe & re-seed the database |
| `npm run db:studio` | Open Prisma Studio to browse data |
| `npm run alerts:run` | Run the reminder engine once |

## Going live later (the swap-in points)

Nothing in the app assumes simulation — the seams are small and clearly marked:

1. **Email** — `src/lib/email.ts`, function `deliver()`. Replace the no-op with a
   real transport (SendGrid/SES/SMTP). Queueing and the outbox stay as-is.
2. **File storage** — uploaded files are stored in Postgres (`DocumentBlob`), which
   persists on serverless hosts and needs no extra service. For very large files or
   high volume, switch the upload/download paths to S3/GCS/Supabase Storage.
3. **Deployment** — see [DEPLOYMENT.md](./DEPLOYMENT.md) for Neon (Postgres) + Vercel.
