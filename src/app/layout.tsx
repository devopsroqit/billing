import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter — the app's body typeface, exposed as --font-inter. JetBrains Mono
// backs the `.num` and `font-mono` slots (KPI values, money in tables) so
// digits column-align.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "ROQIT Billing",
  description: "Internal payment & asset tracker — vendors, monthly payments, IoT device procurement, and documents.",
};

// Runs before paint to restore the sidebar state AND the chosen theme. Reading
// localStorage synchronously here (before React hydrates) is what prevents the
// light-mode flash for a viewer whose saved preference is dark.
//   theme = "dark" | "light" | "system" (default: system)
const themeScript = `(function(){try{
  var d=document.documentElement;
  if(localStorage.getItem('sidebar')==='collapsed'){d.classList.add('sidebar-collapsed');}
  var t=localStorage.getItem('theme');
  var dark = t==='dark' || ((t==null||t==='system') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark){d.classList.add('dark');}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
