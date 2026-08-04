# Deploying roqit Billing for your team

This guide takes you from "runs on my laptop" to "the whole office logs in from
their own computers." It uses:

- **Neon** — a free managed PostgreSQL database (one shared copy of the data)
- **Vercel** — free hosting for the Next.js app
- **Google Drive links** — for invoice/receipt documents (no extra storage to set up)

You'll create two free accounts (Neon + Vercel). Nothing here needs a credit card
for normal internal use.

---

## Step 1 — Create the database (Neon)

1. Go to **https://neon.tech** and sign up (you can use your Google account).
2. Create a new project — name it e.g. `roqit-billing`. Pick the region closest
   to your office.
3. On the project dashboard, find **Connection string** and copy it. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/DBNAME?sslmode=require
   ```
   Keep this safe — it's the key to your data.

## Step 2 — Point the app at it and load the starting data

On your laptop, in the project folder:

```powershell
# put the Neon string in your local .env
copy .env.example .env
```
Open `.env` in Notepad and set:
- `DATABASE_URL` → the Neon connection string from Step 1
- `AUTH_SECRET` → any long random string (30+ characters)

Then create the tables and seed the demo data **into Neon**:

```powershell
npm install
npm run setup      # creates tables in Neon + loads demo services/data
npm run dev        # http://localhost:3000 — now backed by the shared database
```

> From now on your laptop and the deployed site both talk to the **same** Neon
> database, so data is consistent everywhere.

## Step 3 — Deploy the app (Vercel)

1. Go to **https://vercel.com** and sign up with your GitHub account.
2. Click **Add New → Project** and import the **`skanojiya-design/Billing`** repo.
3. When it asks for the branch, pick your feature branch (or merge it to `main`
   first and deploy `main` — recommended once you're happy with it).
4. Before the first deploy, open **Environment Variables** and add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | your Neon connection string |
   | `AUTH_SECRET` | the same long random string |
   | `ALERT_DUE_SOON_DAYS` | `5` (optional) |
5. Click **Deploy**. In a minute you'll get a URL like
   `https://roqit-billing.vercel.app` — share that with the office.

Because the tables were already created in Step 2, the deployed app is ready to
use immediately. Everyone logs in at that URL.

## Step 4 — Add your team

Log in as `admin@roqit.com` (password `password123`), go to **Team**, and:

1. **Change the admin password / email** (edit the admin user) — don't leave the
   demo password on a live site.
2. **Add each office member** with the right role:
   - **Admin** — full access + manage team
   - **Editor** — add/edit payments, mark paid, attach documents
   - **Viewer** — read-only, can view & download documents

## Documents

Each payment row supports two ways to attach an invoice/receipt:

- **Upload a file** — the file is stored **inside the Postgres database**, so it
  persists across deploys and is shared by everyone (works the same on a laptop
  and on Vercel). Keep individual files modest (max 10 MB); the free Neon tier's
  0.5 GB holds thousands of typical invoices.
- **Paste a link** — e.g. a Google Drive link into your existing
  `ROQIT - SharedFolder`. Nothing is stored in the app; only the URL.

Use whichever suits each row.

## Reminders (optional)

To have "due soon / overdue" emails go out automatically, add a **Vercel Cron
Job** hitting `GET /api/cron/run-alerts` once a day (set `CRON_SECRET` and pass
`?key=...`). Email is still simulated until you connect a real provider in
`src/lib/email.ts` — ask me when you want that turned on.

---

### Everyday updates

When I push new features to the branch, Vercel redeploys automatically. If a
change touches the database structure, run `npm run db:push` locally (pointed at
Neon) once — I'll always tell you when that's needed.
