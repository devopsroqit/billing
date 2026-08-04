"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

// A sliding switch that toggles the `dark` class on <html> and persists the
// choice. The initial class is set by an inline script in the root layout to
// avoid a flash. The knob slides right for dark, left for light, with sun/moon
// icons framing the track.
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <div className="sidebar-compact flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2">
      <span className="sidebar-label text-sm font-medium text-muted">{dark ? "Dark mode" : "Light mode"}</span>
      <button
        type="button"
        role="switch"
        aria-checked={mounted ? dark : undefined}
        onClick={toggle}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle dark mode"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 ${
          dark ? "bg-brand-600 ring-brand-600" : "bg-surface-2 ring-border"
        }`}
      >
        <Icon name="sun" className="pointer-events-none absolute left-1 h-3.5 w-3.5 text-amber-500" />
        <Icon
          name="moon"
          className={`pointer-events-none absolute right-1 h-3.5 w-3.5 ${dark ? "text-white" : "text-faint"}`}
        />
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-1 ring-black/5 transition-transform ${
            dark ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
