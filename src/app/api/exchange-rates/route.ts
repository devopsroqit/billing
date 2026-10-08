import { NextResponse } from "next/server";

// Live exchange rates for the subscription forms, so entering an amount in one
// currency auto-fills the others. Backed by frankfurter.app — free, no key,
// daily ECB rates. Cached module-side so we don't hit the API on every form
// mount; refreshed when the cache is older than CACHE_TTL_MS.

export const dynamic = "force-dynamic";

type Rates = { INR: number; USD: number; EUR: number };
type Payload = {
  base: "USD";
  rates: Rates;
  // ISO date from frankfurter (`YYYY-MM-DD`) — the business day the rates
  // apply to; may lag the current date on weekends / holidays.
  rateDate: string;
  fetchedAt: string;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type CacheEntry = { payload: Payload; at: number };
let cache: CacheEntry | null = null;
let inflight: Promise<Payload | null> | null = null;

async function fetchFresh(): Promise<Payload | null> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?base=USD&symbols=USD,INR,EUR",
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.rates;
    if (!r || typeof r.INR !== "number" || typeof r.EUR !== "number") return null;
    return {
      base: "USD",
      rates: { USD: 1, INR: r.INR, EUR: r.EUR },
      rateDate: typeof data.date === "string" ? data.date : new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, ...cache.payload, stale: false });
  }

  // De-dupe concurrent refreshes.
  if (!inflight) inflight = fetchFresh().finally(() => { inflight = null; });
  const fresh = await inflight;

  if (fresh) {
    cache = { payload: fresh, at: now };
    return NextResponse.json({ ok: true, ...fresh, stale: false });
  }

  // Refresh failed — serve the last known rates with stale: true so the UI
  // can show "rates from <date>" instead of hiding the auto-fill entirely.
  if (cache) {
    return NextResponse.json({ ok: true, ...cache.payload, stale: true });
  }
  return NextResponse.json({ ok: false, error: "Exchange rates unavailable" }, { status: 503 });
}
