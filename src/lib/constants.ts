// Central definition of every "enum-like" value. Because SQLite stores these as
// plain strings, keeping the allowed values + labels here is what keeps the app
// consistent and makes a future move to Postgres enums painless.

// --- Access roles ----------------------------------------------------------
export const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};
export const ROLE_HINTS: Record<Role, string> = {
  ADMIN: "Full access + manage team members",
  EDITOR: "Add/edit payments, mark paid, upload documents",
  VIEWER: "Read-only — can view & download documents",
};

// --- Vendor / service type --------------------------------------------------
export const VENDOR_TYPES = ["SUBSCRIPTION", "SERVICE"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];
export const VENDOR_TYPE_LABELS: Record<VendorType, string> = {
  SUBSCRIPTION: "Subscription",
  SERVICE: "Service",
};

// --- Billing frequency ------------------------------------------------------
export const BILLING_FREQUENCIES = [
  "MONTHLY",
  "ANNUAL",
  "MONTHLY_USAGE",
  "PAY_AS_YOU_GO",
  "ONE_TIME",
] as const;
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];
export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
  MONTHLY_USAGE: "Monthly (Usage)",
  PAY_AS_YOU_GO: "Pay as you go",
  ONE_TIME: "One-time",
};

// --- Payment status ---------------------------------------------------------
export const ENTRY_STATUSES = ["PENDING", "PAID", "OVERDUE"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  OVERDUE: "Overdue",
};

// --- Currencies -------------------------------------------------------------
export const CURRENCIES = ["INR", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
};

// --- Email alert types ------------------------------------------------------
export const EMAIL_TYPES = ["DUE_SOON", "OVERDUE", "GENERIC"] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

// --- Assets & Procurement ---------------------------------------------------
export const SUPPLIER_TYPES = ["OEM", "DISTRIBUTOR", "OTHER"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];
export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  OEM: "OEM",
  DISTRIBUTOR: "Distributor",
  OTHER: "Other",
};

export const DEVICE_STATUSES = [
  "IN_STOCK",
  "DEPLOYED",
  "FAULTY",
  "IN_REPAIR",
  "RETURNED",
  "RETIRED",
] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  IN_STOCK: "In stock",
  DEPLOYED: "Deployed",
  FAULTY: "Faulty",
  IN_REPAIR: "In repair",
  RETURNED: "Returned",
  RETIRED: "Retired",
};

export const DEPLOYMENT_ACTIONS = ["DEPLOYED", "RETURNED", "TRANSFERRED", "REPAIR"] as const;
export type DeploymentAction = (typeof DEPLOYMENT_ACTIONS)[number];
export const DEPLOYMENT_ACTION_LABELS: Record<DeploymentAction, string> = {
  DEPLOYED: "Deployed",
  RETURNED: "Returned to stock",
  TRANSFERRED: "Transferred",
  REPAIR: "Sent for repair",
};

// A few suggested device categories (the field is free text).
export const DEVICE_CATEGORY_SUGGESTIONS = [
  "GPS Tracker",
  "Gateway",
  "Sensor",
  "SIM / Connectivity",
  "Camera",
  "Controller",
  "Other",
] as const;

// --- Month helpers ----------------------------------------------------------
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Tailwind classes for status badges, keyed by status value.
// Alpha-based tints so badges read well on both light and dark surfaces.
export const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PAID: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  OVERDUE: "bg-red-500/15 text-red-600 dark:text-red-400",
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  INACTIVE: "bg-slate-500/15 text-muted",
  QUEUED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/15 text-red-600 dark:text-red-400",
  // Device lifecycle
  IN_STOCK: "bg-slate-500/15 text-muted",
  DEPLOYED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAULTY: "bg-red-500/15 text-red-600 dark:text-red-400",
  IN_REPAIR: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  RETURNED: "bg-brand-500/15 text-brand-600 dark:text-brand-500",
  RETIRED: "bg-slate-500/15 text-muted",
};
