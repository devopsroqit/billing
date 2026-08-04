// All money is stored as integer minor units (paise for INR, cents for USD/EUR)
// to avoid floating-point rounding errors. These helpers convert to/from the
// major unit for display & input.

import type { Currency } from "./constants";

export function minorToMajor(minor: number): number {
  return minor / 100;
}

export function majorToMinor(major: number): number {
  return Math.round(major * 100);
}

const LOCALE: Record<Currency, string> = {
  INR: "en-IN", // ₹1,23,456.00 grouping
  USD: "en-US",
  EUR: "en-IE",
};

/** Format minor units as a localized currency string, e.g. "₹1,23,456.00". */
export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Same, but drop the decimals when the amount is whole. */
export function formatMoneyCompact(minor: number, currency: Currency): string {
  const major = minor / 100;
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: major % 1 === 0 ? 0 : 2,
  }).format(major);
}
