"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

// Cycles Light → Dark → System (follows OS `prefers-color-scheme`). The choice
// persists in localStorage and is applied inline in the root <html> before
// paint (see layout.tsx) so there's no flash on load. Kept small on purpose —
// one control, three states, the icon tells you which is active.
type Theme = "light" | "dark" | "system";

const NEXT: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
const LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };
const ICON: Record<Theme, string> = { light: "sun", dark: "moon", system: "monitor" };

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function read(): Theme {
  try {
    const v = localStorage.getItem("theme");
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch { /* ignore */ }
  return "system";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // Read once after mount so SSR renders the safe default; then keep the
  // "system" preference live by listening for OS changes.
  useEffect(() => {
    setTheme(read());
    setMounted(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => { if (read() === "system") apply("system"); };
    mq.addEventListener("change", onOs);
    return () => mq.removeEventListener("change", onOs);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[theme]} · click to change`}
      aria-label={`Change theme (currently ${LABEL[theme]})`}
      className="sidebar-compact btn-secondary mt-1 w-full text-sm"
    >
      <Icon name={mounted ? ICON[theme] : "monitor"} className="h-[18px] w-[18px] shrink-0" />
      <span className="sidebar-label">{mounted ? LABEL[theme] : "System"}</span>
    </button>
  );
}
