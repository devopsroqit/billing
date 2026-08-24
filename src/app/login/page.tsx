"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginLayout />
    </Suspense>
  );
}

// Split-screen sign-in: the form on the left, a compact preview of the
// devices dashboard on the right. Reuses the app's sharp-dark tokens so it
// looks native alongside the rest of the product; the pre-paint theme script
// (in the root layout) still applies here, so a viewer with a saved "light"
// preference sees a light rendering instead.
function LoginLayout() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[5fr_6fr]">
      <LoginPanel />
      <PreviewPanel />
    </div>
  );
}

function LoginPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const next = params.get("next") || "/";
      router.push(next);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandLogo className="h-7 w-auto" />
          <span className="border-l border-border pl-3 font-mono text-[11px] uppercase tracking-widest text-faint">
            Billing
          </span>
        </div>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-fg">
          Welcome back.
        </h1>
        <p className="mt-2 max-w-xs text-sm text-muted">
          One tracker for payments, deals, and devices — sign in to pick up where you left off.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="you@roqit.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <p className="mt-8 text-xs text-faint">
          Internal ROQIT tool. Contact your admin for access.
        </p>
      </div>
    </div>
  );
}

// Ambient marketing-style panel — shown only on lg+ so it never eats the
// login form on smaller screens. Numbers are illustrative (a "product
// preview", not live data — we don't leak counts to logged-out visitors) and
// device-only, per the design brief.
function PreviewPanel() {
  return (
    <div className="relative hidden overflow-hidden border-l border-border bg-surface-2/40 lg:block">
      {/* Ambient radial glow from bottom-center — reads as light coming up
          from behind the mocked dashboard, matching the reference. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 100%, rgb(37 99 235 / 0.18), transparent 70%)",
        }}
      />
      {/* Very subtle grid to give the empty ground some texture without
          fighting the product mock. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--fg)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--fg)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-8 px-10 py-16">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-6 w-auto" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-faint">Devices</span>
        </div>

        <DeviceMock />

        <p className="max-w-md text-center text-sm text-muted">
          Track every device from purchase order to installation. One inventory,
          shared across the team.
        </p>
      </div>
    </div>
  );
}

// Mocked devices dashboard — 4 KPI tiles in a 2×2 grid inside a hairline
// "browser-ish" panel. Everything device-only, no money on this side by
// design brief.
function DeviceMock() {
  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl backdrop-blur-sm">
      {/* Fake window bar — three dots + a filename */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-faint/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-faint/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-faint/40" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-faint">
          Devices · overview
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        <MockTile label="Total devices" value="1,247" hint="+18 this week" up />
        <MockTile label="Deployed" value="984" hint="79% of inventory" />
        <MockTile label="In stock" value="263" hint="ready to ship" />
        <MockTile label="Installed · this month" value="41" hint="+12 vs prev" up />
      </div>
    </div>
  );
}

function MockTile({
  label,
  value,
  hint,
  up = false,
}: {
  label: string;
  value: string;
  hint: string;
  up?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-faint">{label}</p>
      <p className="num text-2xl font-medium leading-tight text-fg">{value}</p>
      <p className={`text-[11px] ${up ? "text-emerald-500" : "text-muted"}`}>{hint}</p>
    </div>
  );
}
