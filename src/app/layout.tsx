import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROQIT Billing",
  description: "Internal payment & asset tracker — vendors, monthly payments, IoT device procurement, documents & alerts.",
};

// Runs before paint to set the theme class from the saved choice or the OS
// preference, avoiding a light/dark flash on load.
const themeScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark');}if(localStorage.getItem('sidebar')==='collapsed'){d.classList.add('sidebar-collapsed');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
