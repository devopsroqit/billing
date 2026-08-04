import Link from "next/link";
import { STATUS_BADGE, CURRENCY_SYMBOLS, type Currency } from "@/lib/constants";
import { formatMoneyCompact } from "@/lib/money";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-surface-2 text-fg";
  return <span className={`badge ${cls}`}>{label ?? status.replace(/_/g, " ").toLowerCase()}</span>;
}

/** Render a minor-unit amount, or a muted dash when zero. */
export function Money({ minor, currency }: { minor: number; currency: Currency }) {
  if (!minor) return <span className="text-faint">—</span>;
  return <span>{formatMoneyCompact(minor, currency)}</span>;
}

export { CURRENCY_SYMBOLS };

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  href?: string;
}) {
  const toneCls = {
    default: "text-fg",
    warning: "text-amber-600",
    danger: "text-red-600",
    success: "text-green-600",
  }[tone];
  const inner = (
    <div className="card p-5 h-full">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneCls}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}
