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

---

### Everyday updates

When I push new features to the branch, Vercel redeploys automatically. If a
change touches the database structure, run `npm run db:push` locally (pointed at
Neon) once — I'll always tell you when that's needed.

---

## Restoring from a bad change

Prod is on Neon with **30-day point-in-time restore** — any moment in the last
30 days can be reconstructed. This is the runbook for the day you (or I) need
to actually use it. Read it before you need it; the middle of an incident is a
bad time to learn a new tool.

### When to use it

Use PITR when data is *wrong* and you can name the timestamp when it was right:

- **"Someone deleted a company / contact / deal by mistake."**
- **"A bad import ran and doubled a bunch of payments."**
- **"An admin ran the seed script against prod."** (Yes, this happens.)
- **"A migration wiped a column and I need the old values back."**

Do **not** use it for a normal application bug (the DB is fine, the code is
wrong — fix the code). Do **not** use it to try to "roll back a deploy" — Vercel
handles that; PITR is a data tool.

### How it works, in one paragraph

Neon lets you spin up a **branch** of the DB "as of" any timestamp in the
retention window. The branch is a fully queryable copy at that moment, on its
own connection string. You point a scratch environment at the branch to
inspect it. Once you're sure it holds the data you want, you either **copy
specific rows back** to the main branch, or **swap `DATABASE_URL` on Vercel**
to promote the branch to prod. The main branch is untouched throughout — nothing
is destroyed until you consciously promote or delete.

### The three-step recovery

1. **Create a branch at the target time.**
   - Open the Neon console → the project → **Branches** → **Create branch**.
   - Source: `main`. "Time travel": pick a timestamp **just before** the bad
     change happened. If you don't know when it happened, start with "1 hour
     ago" and step back.
   - Name it `restore-YYYY-MM-DD-HHmm` so you don't confuse it later.
   - Copy the new branch's connection string.

2. **Inspect on a scratch instance.**
   - Fastest: run the app locally against the branch:
     ```
     DATABASE_URL="<restore-branch-string>" AUTH_SECRET="anything-long" npx next start -p 3010
     ```
     Then open `http://localhost:3010` and browse `/crm/deals`, `/crm/companies`,
     `/tracker` — confirm the lost data is there.
   - Or open Neon's SQL editor on the branch and run a targeted query
     (`select * from "Company" where name = 'GreenFleet Mobility'`) — quicker
     for a single record.

3. **Recover.** Two options, pick based on scale:
   - **Small (a few rows):** connect to the restore branch with your favourite
     SQL client, `SELECT` the rows, then connect to prod (the main branch) and
     `INSERT` them back. Best for "we lost one company" — surgical.
   - **Large (the whole DB is wrong):** in Vercel → **Settings → Environment
     Variables**, change `DATABASE_URL` from the main branch's string to the
     restore branch's string, redeploy. The app is now backed by the restored
     data. When you're sure it's the right state, in Neon → set the restore
     branch as the new primary (Neon calls this "promote"), then swap Vercel's
     `DATABASE_URL` back to the main branch string. Best for "a bad migration
     ran overnight" — nuclear.

Delete the restore branch when done (Neon → Branches → ⋯ → Delete) so it stops
counting toward storage.

### Who to call

- **Owner:** Shiv (has Neon + Vercel admin).
- **On the SQL side:** ask me to rehearse the exact statements before running
  anything against prod. Please don't hand-type `DELETE FROM …` on the main
  branch under pressure — 20 min of rehearsal on the restore branch has saved
  a lot of production databases.

### Verify it works — occasionally

Once a quarter, run the drill:

1. Create a branch from ~1 hour ago.
2. Point local `next start` at it.
3. Confirm the data matches what you had an hour ago.
4. Delete the branch.

It takes 10 minutes and is the only way to know backups actually work. A
backup you've never restored isn't a backup — it's a wish.
