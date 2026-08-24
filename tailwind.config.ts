import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand accent — ROQIT blue. Works on both light and dark surfaces.
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Semantic tokens backed by CSS variables (see globals.css). These flip
        // automatically between light and dark, so the whole UI themes centrally.
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
      },
      fontFamily: {
        // Inter (loaded in layout.tsx) with a system fallback — Frappe's typeface.
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        // JetBrains Mono — used for KPI values, money, and any column of digits.
        // Same family Supabase Studio uses; keeps numbers precisely aligned.
        mono: ["var(--font-mono)", "ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        // Tighten the base "lg" radius from Tailwind's default 8px to 6px so
        // every card, input, and button reads a touch sharper without any
        // component edits.
        lg: "0.375rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(24 24 27 / 0.05)",
        // Legacy alias — still resolvable, but `.card` no longer applies it.
        card: "0 1px 2px 0 rgb(24 24 27 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
