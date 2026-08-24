import Link from "next/link";

// Server-safe pagination footer. Renders "Showing X-Y of N" and prev/next
// links that carry every URL param through. Skips itself when a page comfortably
// fits (total <= pageSize) so short lists don't grow visual weight.

type Props = {
  total: number;
  page: number;
  pageSize: number;
  /** Absolute base pathname the page lives on, e.g. "/crm/deals". */
  basePath: string;
  /** All *other* URL params from the page (q, stage, etc.) — carried through. */
  params: Record<string, string>;
};

export function Pager({ total, page, pageSize, basePath, params }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0 || totalPages === 1) return null;

  const clamp = (p: number) => Math.min(Math.max(1, p), totalPages);
  const url = (p: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) s.set(k, v);
    if (p !== 1) s.set("page", String(clamp(p)));
    const q = s.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const NAV = "num inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-fg hover:bg-surface-2";
  const DISABLED = "num inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs text-faint cursor-not-allowed";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
      <p className="num">
        <span className="font-mono text-faint">{from.toLocaleString()}–{to.toLocaleString()}</span>
        <span className="mx-1 text-faint">/</span>
        <span className="font-mono text-fg">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={url(page - 1)} className={NAV} aria-label="Previous page">← Prev</Link>
        ) : (
          <span className={DISABLED} aria-hidden="true">← Prev</span>
        )}
        <span className="num text-faint">
          <span className="font-mono">Page {page} of {totalPages}</span>
        </span>
        {page < totalPages ? (
          <Link href={url(page + 1)} className={NAV} aria-label="Next page">Next →</Link>
        ) : (
          <span className={DISABLED} aria-hidden="true">Next →</span>
        )}
      </div>
    </div>
  );
}
