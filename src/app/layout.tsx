import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// IBM Plex Sans — the Carbon/IBM typeface. Self-hosted by next/font; exposed as
// --font-plex which the Tailwind `sans` stack points at. Weight 300 carries the
// light display headings that are IBM's signature; 400/600 for body & emphasis.
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "ROQIT Billing",
  description: "Internal payment & asset tracker — vendors, monthly payments, IoT device procurement, and documents.",
};

// Runs before paint to restore the saved sidebar state. The app is light-mode
// only (dark mode was removed), so no theme class is applied.
const themeScript = `(function(){try{if(localStorage.getItem('sidebar')==='collapsed'){document.documentElement.classList.add('sidebar-collapsed');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
