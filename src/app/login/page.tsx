import { Suspense } from "react";
import { startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "./LoginForm";

// The login page is now a server component so the preview panel on the right
// can show *live* aggregate device counts from the DB instead of illustrative
// numbers that get stale. All counts are aggregate — no personal or record-
// level data crosses the auth boundary.
export const dynamic = "force-dynamic";

type Stats = { total: number; deployed: number; inStock: number; thisMonth: number };

async function getDeviceStats(): Promise<Stats | null> {
  const monthStart = startOfMonth(new Date());
  try {
    const [total, deployed, inStock, thisMonth] = await Promise.all([
      prisma.device.count(),
      prisma.device.count({ where: { status: "DEPLOYED" } }),
      prisma.device.count({ where: { status: "IN_STOCK" } }),
      prisma.device.count({ where: { createdAt: { gte: monthStart } } }),
    ]);
    return { total, deployed, inStock, thisMonth };
  } catch {
    // If the DB is unreachable at first paint (e.g. Neon cold start), don't
    // break the login form — just hide the mock. The form still works.
    return null;
  }
}

export default async function LoginPage() {
  const stats = await getDeviceStats();
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[5fr_6fr]">
      <LoginColumn />
      <PreviewPanel stats={stats} />
    </div>
  );
}

function LoginColumn() {
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

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-xs text-faint">
          Internal ROQIT tool. Contact your admin for access.
        </p>
      </div>
    </div>
  );
}

function PreviewPanel({ stats }: { stats: Stats | null }) {
  return (
    <div className="relative hidden overflow-hidden border-l border-border bg-surface-2/40 lg:block">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 100%, rgb(37 99 235 / 0.18), transparent 70%)",
        }}
      />
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

        {stats && <DeviceMock stats={stats} />}

        <p className="max-w-md text-center text-sm text-muted">
          Track every device from purchase order to installation. One inventory,
          shared across the team.
        </p>
      </div>
    </div>
  );
}

function DeviceMock({ stats }: { stats: Stats }) {
  const deployedPct = stats.total > 0 ? Math.round((stats.deployed / stats.total) * 100) : 0;
  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl backdrop-blur-sm">
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
        <MockTile
          label="Total devices"
          value={stats.total.toLocaleString("en-IN")}
          hint="in the inventory"
        />
        <MockTile
          label="Deployed"
          value={stats.deployed.toLocaleString("en-IN")}
          hint={stats.total > 0 ? `${deployedPct}% of inventory` : "—"}
        />
        <MockTile
          label="In stock"
          value={stats.inStock.toLocaleString("en-IN")}
          hint="ready to ship"
        />
        <MockTile
          label="Added · this month"
          value={stats.thisMonth.toLocaleString("en-IN")}
          hint={stats.thisMonth > 0 ? "new this month" : "no new devices yet"}
          up={stats.thisMonth > 0}
        />
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
