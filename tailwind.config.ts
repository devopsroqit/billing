import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand accent — IBM Blue (Carbon blue-60 = #0f62fe), the single accent.
        brand: {
          50: "#edf5ff",
          100: "#d0e2ff",
          200: "#a6c8ff",
          500: "#4589ff",
          600: "#0f62fe",
          700: "#0043ce",
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
        // IBM Plex Sans (loaded in layout.tsx) with a Carbon-spec fallback.
        sans: ["var(--font-plex)", "Helvetica Neue", "Arial", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Carbon is flat & square: every corner is 0px (buttons, cards, inputs,
      // tags, avatars). Mapping the whole scale to 0 squares every rounded-*.
      borderRadius: {
        none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "0",
      },
      // Carbon carries hierarchy with 1px hairlines, not shadows.
      boxShadow: {
        sm: "none",
        card: "none",
        DEFAULT: "none",
      },
    },
  },
  plugins: [],
};

export default config;
