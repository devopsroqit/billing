import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter — Frappe's typeface. Self-hosted by next/font; exposed as --font-inter
// which the Tailwind `sans` stack points at.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "ROQIT Billing",
  description: "Internal payment & asset tracker — vendors, monthly payments, IoT device procurement, and documents.",
};

// Runs before paint to restore the saved sidebar state. The app is light-mode
// only (dark mode was removed), so no theme class is applied.
const themeScript = `(function(){try{if(localStorage.getItem('sidebar')==='collapsed'){document.documentElement.classList.add('sidebar-collapsed');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
