# ROQIT Billing — User Guide

A practical, start-to-finish guide to the ROQIT internal tracker. If you've
never opened the app before, read from the top — it explains what the app is,
then walks through every screen and the everyday tasks you'll do in it.

---

## Table of contents

1. [What is this app?](#1-what-is-this-app)
2. [Key ideas in 60 seconds](#2-key-ideas-in-60-seconds)
3. [Signing in](#3-signing-in)
4. [Finding your way around](#4-finding-your-way-around)
5. [Roles & permissions](#5-roles--permissions)
6. [The Dashboard](#6-the-dashboard)
7. [Services — your recurring vendors](#7-services--your-recurring-vendors)
8. [Monthly Tracker — the heart of the app](#8-monthly-tracker--the-heart-of-the-app)
9. [Documents — invoices & receipts](#9-documents--invoices--receipts)
10. [Alerts & Email](#10-alerts--email)
11. [Assets & Procurement](#11-assets--procurement)
12. [Team (admins only)](#12-team-admins-only)
13. [Common tasks — quick recipes](#13-common-tasks--quick-recipes)
14. [Reference tables](#14-reference-tables)
15. [FAQ & troubleshooting](#15-faq--troubleshooting)

---

## 1. What is this app?

**ROQIT Billing** is our internal web app for keeping track of **the money the
company pays out every month** — the subscriptions and services ROQIT relies on
(GitHub, AWS, Flespi, Twilio/MSG91, Vercel, connectivity, and so on) — plus the
**IoT devices we buy** from OEMs and distributors.

It replaces the old shared spreadsheet ("ROQIT_Recurring_Payment_Tracker") with
something that:

- multiple people in the office can use at once, each with the right level of
  access,
- keeps every month's payments in one place with clear **Pending / Paid /
  Overdue** status,
- stores **invoices and receipts** (uploaded files or links) right next to the
  payment they belong to,
- handles **three currencies** (₹ INR, $ USD, € EUR),
- can **export any month to Excel**, and
- tracks **procurement and individual devices** (by serial number / IMEI), where
  each one is, and its history.

> **Important:** this is a **record-keeping tool**. It does **not** move money or
> pay anyone. You record what was billed and mark what has been paid.

---

## 2. Key ideas in 60 seconds

A few words come up everywhere. Learn these and the rest is easy:

- **Service** — a *reusable definition* of a vendor you pay regularly (e.g.
  "AWS", billed monthly, in USD). You set it up once.
- **Payment entry (a "row")** — *one service, in one month*. Each month has its
  own set of rows. A row is what carries the amount, due date, status, and
  documents.
- **Period** — a specific **month + year** (e.g. August 2026). The Monthly
  Tracker always shows one period at a time.
- **Status** — where a row stands: **Pending**, **Paid**, or **Overdue**.
- **Supplier** — a company you *buy devices from* (OEM / distributor).
- **Purchase** — one order/invoice from a supplier.
- **Device** — a single physical unit (tracked by serial no. / IMEI) with a
  lifecycle (in stock → deployed → …).

The relationship, simply:

```
Service (set up once)  ──generates──►  Payment entries (one per month)  ──hold──►  Documents
Supplier  ──►  Purchase  ──►  Device (one per unit)  ──has──►  Deployment history + Documents
```

---

## 3. Signing in

1. Open the app URL in any browser (desktop or phone).
2. Enter your **email** and **password** and click **Sign in**.
3. You'll land on the **Dashboard**.

Your session stays logged in for several days. To leave, use **Sign out** at the
bottom of the sidebar.

> Don't have an account, or forgot your password? Ask an **Admin** — they create
> accounts and can set a new password for you (see [Team](#12-team-admins-only)).

---

## 4. Finding your way around

Everything is reached from the **sidebar** on the left.

- **Top:** the ROQIT logo.
- **Main menu:** Dashboard, Monthly Tracker, Services, Documents, Alerts & Email.
- **Assets section:** Assets overview, Suppliers, Purchases, Devices.
- **Team:** only visible to Admins.
- **Bottom:** the **light/dark toggle**, your name/role, and **Sign out**.

Handy touches:

- **Light / Dark mode** — the slider at the bottom of the sidebar. Your choice is
  remembered on your device; the first time, it follows your computer's setting.
- **Collapse the sidebar** — the little chevron (**«**) at the top collapses the
  menu to a slim icon rail to give you more room. Click it again to expand.
- **On mobile**, the sidebar hides behind the **☰ menu** button at the top.

---

## 5. Roles & permissions

Every account has one of three roles. This keeps sensitive actions in the right
hands.

| Role | Can do | Cannot do |
| --- | --- | --- |
| **Viewer** | View every page; open and download documents | Add or change anything |
| **Editor** | Everything a Viewer can, **plus** add/edit payment rows, mark paid, manage services, suppliers, purchases, devices, and upload documents | Manage team members |
| **Admin** | Everything an Editor can, **plus** create/edit team members and set their roles | — |

If you don't see "Add", "Edit", or the **Team** menu, you're a Viewer or Editor —
that's expected, not a bug.

---

## 6. The Dashboard

Your at-a-glance view for the **current month**:

- **Billed this month (INR)** — total amount due this month.
- **Paid this month (INR)** — what's been paid so far.
- **Outstanding (INR)** — what's still unpaid.
- **Overdue** — count of overdue items (with the number pending).
- **Paid per month** — a small bar chart of the last 6 months.
- **Needs attention** — upcoming and overdue items; click any to jump straight to
  that month in the Tracker.

Use the **Open this month** button (top-right) to go to the current month's
Tracker.

---

## 7. Services — your recurring vendors

A **Service** is the template for a vendor you pay regularly. Setting it up well
means new months fill themselves in for you.

**To add a service:** Services → **New service**, then fill in:

- **Service name** — e.g. "GitHub", "AWS".
- **Type** — *Subscription* or *Service*.
- **Billing frequency** — Monthly, Annual, Monthly (Usage), Pay as you go, or
  One-time.
- **Primary currency** — INR, USD, or EUR.
- **Due day of month** *(optional)* — e.g. `20` means "due on the 20th". Leave it
  blank if there's no fixed day.
- **Default amounts** — typical monthly cost per currency. These **pre-fill** new
  rows so you rarely type them again.
- **Vendor URL / Notes** *(optional)*.
- **Active** — tick to include this service when generating a new month. Untick to
  retire it without deleting history.

> You can edit a service any time. Editing it does **not** rewrite past months —
> each month's row keeps the values it had when it was created.

---

## 8. Monthly Tracker — the heart of the app

This is where the day-to-day work happens. It always shows **one month** at a
time. Switch months with the **‹ Prev / Next ›** arrows or the month tabs.

Each row is one service for that month, with: Service, Type, Frequency, Due date,
Paid on, **Status**, amounts in **INR / USD / EUR**, **Paid (INR)**, its
**Docs**, and Notes. A **Total** row sums each column at the bottom.

### Starting a new month

You have three ways to populate a month (Editors/Admins):

1. **Duplicate [last month]** — copies every row from the previous month, keeping
   amounts and notes but resetting status to *Pending* and rolling due dates
   forward. Best when months look similar. *Safe to run twice — it won't create
   duplicates.*
2. **Generate month** — creates a fresh row for every **active** service that
   doesn't already have one this month, pre-filled from the service defaults.
3. **Add row** — add a single entry by hand (great for one-offs). You can pick an
   existing service to auto-fill, or type a manual name.

### Everyday actions on a row

- **Mark paid** — sets status to *Paid*, stamps today as the payment date, and
  fills "Paid (INR)". Use this the moment a payment goes through.
- **Mark pending** — undoes the above.
- **Edit** — change amounts, dates, status, or notes.
- **Delete** — remove a row (also removes its attached documents).

### Attaching invoices/receipts

Open a row's **Edit** page to attach a **file** (PDF, image…) or a **link** (e.g.
Google Drive). Attached docs appear as 📄 / 🔗 in the row's **Docs** column and
in the central **Documents** library.

### Export to Excel

Click **⬇ Export Excel** to download the currently selected month as a `.xlsx`
file — formatted with headers, currency columns, and a totals row. Perfect for
sharing with finance or archiving.

---

## 9. Documents — invoices & receipts

The **Documents** page is a **searchable library of everything attached**
anywhere in the app — payment rows, purchases, and devices.

- **Files** are stored **inside the database**, so they're safe, shared by
  everyone, and download identically for all users (max **10 MB** per file).
- **Links** point to an external location (Google Drive, a vendor portal, etc.).
- Click a document to open/download it. Editors/Admins can remove documents.

You attach documents from the item they belong to (a Tracker row's Edit page, a
Purchase, or a Device) — see those sections.

---

## 10. Alerts & Email

Helps you stay ahead of due dates.

- **Run alerts** — scans all rows: marks anything past its due date as
  **Overdue**, and queues **due-soon** and **overdue** reminder emails.
- **Send queued email** — flushes the outbox.

> Email is delivered through whatever provider is configured for the
> environment. If none is set up yet, reminders are still **queued and logged**
> so nothing is lost — they'll send once email is switched on. This is an
> Editor/Admin action.

---

## 11. Assets & Procurement

Tracks the IoT hardware ROQIT buys and where each unit ends up. Four screens work
together.

### Assets overview
A summary of your inventory — device counts by status and quick links in.

### Suppliers
The companies you buy from. **New supplier** captures name, **type** (OEM /
Distributor / Other), contact person, email, phone, GSTIN, address, and website.
Mark inactive to hide old ones without losing history.

### Purchases
One record per order/invoice from a supplier: purchase date, reference (PO /
invoice no.), **currency + amount**, and **quantity**. Open a purchase to attach
its **invoice document** and see the devices linked to it.

### Devices
The individual units — this is the detailed inventory, one entry **per physical
device**:

- Identity: **category** (GPS Tracker, Gateway, Sensor…), make, model, **serial
  no.** (must be unique), **IMEI**, asset tag.
- Commercials: cost + currency, purchase date, and links to the supplier/purchase.
- **Status (lifecycle):** In stock → Deployed → Faulty / In repair → Returned →
  Retired.
- **Deployment history:** each time a device is **Deployed**, **Transferred**,
  **Returned to stock**, or **Sent for repair**, log it. The device's current
  location/assignee and status update automatically, and the full movement
  history is kept.
- Attach documents (delivery notes, warranty cards) to a device too.

> If you try to save a device with a serial number that already exists, the app
> stops you with a clear message — serials are unique on purpose.

---

## 12. Team (admins only)

Admins manage who can log in. **Team → New member**:

- Enter **name**, **email**, **role** (Admin / Editor / Viewer), and an initial
  **password** (min 6 characters).
- **Edit** a member to change their role or reset their password.
- **Deactivate** a member to block sign-in without deleting their history (you
  can't deactivate your own account).

---

## 13. Common tasks — quick recipes

**"It's a new month — set it up."**
Monthly Tracker → switch to the new month → click **Duplicate [last month]** (or
**Generate month** if services changed) → adjust any amounts → done.

**"We just paid AWS."**
Monthly Tracker → find the AWS row → **Mark paid**. (Enter the exact amount first
via **Edit** if it differs from the billed figure.)

**"Attach this month's GitHub invoice."**
Monthly Tracker → GitHub row → **Edit** → under Documents choose **Upload file**
(or **Paste a link**) → **Attach document**.

**"Finance wants July's numbers."**
Monthly Tracker → select **July** → **⬇ Export Excel**.

**"We bought 50 trackers from Teltonika."**
Suppliers → add Teltonika (if new) → Purchases → **New purchase** (Teltonika, qty
50, amount) → attach the invoice → Devices → add each unit with its serial/IMEI,
linked to that purchase.

**"A device went out to a customer site."**
Devices → open the device → add a **Deployment** with action **Deployed** and the
site/customer. Its status flips to *Deployed* automatically.

**"Add a new teammate."** *(Admin)*
Team → **New member** → set name, email, role, temporary password → share the
login → ask them to tell you a new password to set, or reset it later.

---

## 14. Reference tables

**Payment status**

| Status | Meaning |
| --- | --- |
| Pending | Billed, not yet paid |
| Paid | Payment made (date + paid amount recorded) |
| Overdue | Past its due date and still unpaid |

**Billing frequency:** Monthly · Annual · Monthly (Usage) · Pay as you go ·
One-time
**Vendor type:** Subscription · Service
**Currencies:** ₹ INR · $ USD · € EUR
**Supplier type:** OEM · Distributor · Other

**Device lifecycle**

| Status | Meaning |
| --- | --- |
| In stock | Held, not deployed |
| Deployed | In the field / with a customer |
| Faulty | Reported not working |
| In repair | Sent out for repair |
| Returned | Came back to stock |
| Retired | End of life, no longer used |

**Deployment actions:** Deployed · Transferred · Returned to stock · Sent for
repair

---

## 15. FAQ & troubleshooting

**I don't see "Add" / "Edit" / "Team".**
You're signed in as a Viewer or Editor. Those actions need Editor (for edits) or
Admin (for Team). Ask an Admin to change your role if needed.

**My upload was rejected.**
Files are capped at **10 MB**. For anything larger, use a **link** (e.g. Google
Drive) instead.

**A month looks empty.**
No rows have been created for it yet. An Editor can **Duplicate** the previous
month, **Generate** from services, or **Add** rows.

**The totals look off.**
Each currency column totals separately (INR, USD, EUR aren't converted into one
another). "Paid (INR)" totals only what's been recorded as paid.

**Editing a service didn't change past months.**
That's intentional — past rows are a snapshot of history. Edit the individual
row if you need to correct a specific month.

**Dark mode / a stale page.**
Toggle theme from the sidebar. If a page looks out of date right after a change,
refresh once (Ctrl/Cmd + Shift + R).

---

*This app is an internal ROQIT tool. For access, role changes, or password
resets, contact an Admin.*
