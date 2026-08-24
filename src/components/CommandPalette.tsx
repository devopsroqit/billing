"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Global search palette. Opens on ⌘K / Ctrl+K (or when anything dispatches the
// `roqit:open-search` custom event), queries /api/search, renders grouped
// matches, and navigates on Enter. Deliberately small and boring — the search
// row is the only fancy interaction; everything else is a plain button.

type Hit = {
  kind: "deal" | "company" | "contact" | "device";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const KIND_LABEL: Record<Hit["kind"], string> = {
  deal: "Deals",
  company: "Companies",
  contact: "Contacts",
  device: "Devices",
};
const KIND_ICON: Record<Hit["kind"], string> = {
  deal: "◆",
  company: "◫",
  contact: "◐",
  device: "▩",
};

const OPEN_EVENT = "roqit:open-search";

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global open triggers: ⌘K / Ctrl+K anywhere, or a manual event dispatch.
  useEffect(() => {
    const openIt = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, openIt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, openIt);
    };
  }, []);

  // Focus + reset each time it opens.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Debounced fetch. Short queries (< 2 chars) show nothing — the API also
  // guards this.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const data = (await r.json()) as { results: Hit[] };
        setHits(data.results ?? []);
        setSelected(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, open]);

  const go = useCallback((h: Hit) => {
    setOpen(false);
    router.push(h.href);
  }, [router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => (s + 1) % hits.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => (s - 1 + hits.length) % hits.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[selected]); }
  };

  // Group hits by kind, preserving the API's ordering (deals, companies,
  // contacts, devices). The `flat` index below is what the arrow keys move
  // through so keyboard order matches visual order.
  const groups = useMemo(() => {
    const g: Record<Hit["kind"], Hit[]> = { deal: [], company: [], contact: [], device: [] };
    for (const h of hits) g[h.kind].push(h);
    return (["deal", "company", "contact", "device"] as const)
      .filter((k) => g[k].length > 0)
      .map((k) => ({ kind: k, items: g[k] }));
  }, [hits]);

  if (!open) return null;

  let flat = -1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]"
    >
      <div className="modal-backdrop absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div
        className="modal-in relative w-full max-w-xl overflow-hidden rounded-md border border-border bg-surface shadow-2xl"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <span className="font-mono text-xs text-faint">⌕</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent py-3 text-sm text-fg outline-none placeholder:text-faint"
            placeholder="Search deals, companies, contacts, devices…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd className="hidden font-mono text-[10px] text-faint sm:inline">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {loading && (
            <p className="px-4 py-6 text-center text-xs text-muted">Searching…</p>
          )}
          {!loading && q.trim().length >= 2 && groups.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted">No matches for “{q.trim()}”.</p>
          )}
          {!loading && q.trim().length < 2 && (
            <p className="px-4 py-6 text-center text-xs text-muted">Type at least two characters.</p>
          )}
          {!loading && groups.map(({ kind, items }) => (
            <div key={kind} className="pb-1">
              <p className="px-4 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                {KIND_LABEL[kind]}
              </p>
              {items.map((h) => {
                flat++;
                const active = flat === selected;
                return (
                  <button
                    key={`${h.kind}:${h.id}`}
                    type="button"
                    onMouseEnter={() => setSelected(flat)}
                    onClick={() => go(h)}
                    className={`flex w-full items-start gap-3 px-4 py-2 text-left text-sm ${
                      active ? "bg-surface-2 text-fg" : "text-fg hover:bg-surface-2"
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 font-mono text-xs ${active ? "text-brand-600" : "text-faint"}`}>
                      {KIND_ICON[h.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-tight">{h.title}</p>
                      {h.subtitle && <p className="mt-0.5 truncate text-xs text-muted">{h.subtitle}</p>}
                    </div>
                    {active && <span className="font-mono text-[10px] text-faint">↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/50 px-4 py-2 font-mono text-[10px] text-faint">
          <span>↑↓ navigate</span>
          <span>↵ open · ESC close</span>
        </div>
      </div>
    </div>
  );
}
