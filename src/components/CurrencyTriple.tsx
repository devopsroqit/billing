"use client";

import { useEffect, useRef, useState } from "react";

// Three linked currency amount inputs (INR / USD / EUR). Typing in one field
// auto-fills the other two using live rates from /api/exchange-rates (last
// typed wins; nothing is read-only). If rates are unavailable, we fall back
// to independent manual entry with a small inline warning.
//
// The three inputs carry real form `name` attributes so this component drops
// into any <form action={...}> and submits exactly like three plain inputs.

type Rates = { INR: number; USD: number; EUR: number };
type RateResponse = {
  ok: boolean;
  rates?: Rates;
  rateDate?: string;
  stale?: boolean;
};

export type CurrencyTripleProps = {
  // Submitted names for the three inputs. Entry form uses "amountInr/Usd/Eur";
  // Service form uses "defaultInr/Usd/Eur".
  names: { inr: string; usd: string; eur: string };
  // Initial major-unit string values (e.g. "100", "" for empty). The caller
  // controls them so the form parent can reset them (e.g. EntryForm's service
  // picker fills defaults).
  values: { inr: string; usd: string; eur: string };
  onChange: (next: { inr: string; usd: string; eur: string }) => void;
  labels?: { inr: string; usd: string; eur: string };
};

const defaultLabels = { inr: "Amount (INR)", usd: "Amount (USD)", eur: "Amount (EUR)" };

function format(n: number) {
  if (!isFinite(n)) return "";
  // Two decimal places, trimmed of trailing zeros, kept simple for a form field.
  return (Math.round(n * 100) / 100).toString();
}

function formatRateDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CurrencyTriple({ names, values, onChange, labels = defaultLabels }: CurrencyTripleProps) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        const res = await fetch("/api/exchange-rates", { cache: "no-store" });
        const data = (await res.json()) as RateResponse;
        if (cancelled.current) return;
        if (res.ok && data.ok && data.rates) {
          setRates(data.rates);
          setRateDate(data.rateDate ?? null);
          setStale(Boolean(data.stale));
          setFailed(false);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled.current) setFailed(true);
      }
    })();
    return () => { cancelled.current = true; };
  }, []);

  // Change one field → recompute the other two from `rates`. If rates aren't
  // loaded yet (or failed), the other fields stay as the user left them.
  function onInput(which: "inr" | "usd" | "eur", raw: string) {
    const next = { ...values, [which]: raw };
    const n = parseFloat(raw);
    if (rates && isFinite(n) && n >= 0) {
      // Rates are quoted vs USD, so normalize through USD.
      const usd = which === "usd" ? n : which === "inr" ? n / rates.INR : n / rates.EUR;
      if (which !== "usd") next.usd = format(usd);
      if (which !== "inr") next.inr = format(usd * rates.INR);
      if (which !== "eur") next.eur = format(usd * rates.EUR);
    } else if (rates && raw === "") {
      // Clearing one field clears the derived others, so the user can start
      // fresh in a different currency without stale digits lingering.
      next.inr = "";
      next.usd = "";
      next.eur = "";
    }
    onChange(next);
  }

  const prettyDate = formatRateDate(rateDate ?? undefined);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">{labels.inr}</label>
          <input
            className="input"
            name={names.inr}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={values.inr}
            onChange={(e) => onInput("inr", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{labels.usd}</label>
          <input
            className="input"
            name={names.usd}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={values.usd}
            onChange={(e) => onInput("usd", e.target.value)}
          />
        </div>
        <div>
          <label className="label">{labels.eur}</label>
          <input
            className="input"
            name={names.eur}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={values.eur}
            onChange={(e) => onInput("eur", e.target.value)}
          />
        </div>
      </div>

      {failed ? (
        <p className="mt-2 text-xs text-muted">
          Live exchange rates are unavailable — enter each amount manually.
        </p>
      ) : rates ? (
        <p className="mt-2 text-xs text-muted">
          Linked{prettyDate ? ` · rates from ${prettyDate}` : ""}
          {stale ? " (cached)" : ""} ·{" "}
          <span className="num">1 USD ≈ ₹{format(rates.INR)} · €{format(rates.EUR)}</span>
        </p>
      ) : (
        <p className="mt-2 text-xs text-faint">Loading exchange rates…</p>
      )}
    </div>
  );
}
