"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { BrandLogo } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };
const SECTIONS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: "bar-chart-2" },
      { href: "/tracker", label: "Monthly Tracker", icon: "calendar" },
      { href: "/services", label: "Services", icon: "repeat" },
      { href: "/documents", label: "Documents", icon: "folder" },
      { href: "/alerts", label: "Alerts & Email", icon: "bell" },
    ],
  },
  {
    heading: "Assets",
    items: [
      { href: "/assets", label: "Assets overview", icon: "package" },
      { href: "/suppliers", label: "Suppliers", icon: "truck" },
      { href: "/purchases", label: "Purchases", icon: "shopping-cart" },
      { href: "/devices", label: "Devices", icon: "cpu" },
    ],
  },
  {
    items: [{ href: "/team", label: "Team", icon: "users", adminOnly: true }],
  },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 sidebar-full-logo">
      <BrandLogo className="h-6 w-auto" />
      <span className="border-l border-border pl-2 text-xs font-medium text-faint">Billing</span>
    </div>
  );
}

export function Sidebar({ user }: { user: { name: string; email: string; role: Role } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => setCollapsed(document.documentElement.classList.contains("sidebar-collapsed")), []);

  function toggleCollapse() {
    const next = !document.documentElement.classList.contains("sidebar-collapsed");
    document.documentElement.classList.toggle("sidebar-collapsed", next);
    try {
      localStorage.setItem("sidebar", next ? "collapsed" : "expanded");
    } catch {
      /* ignore */
    }
    setCollapsed(next);
  }

  const sections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.adminOnly || user.role === "ADMIN"),
  })).filter((s) => s.items.length > 0);

  const navList = (
    <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-3">
      {sections.map((section, i) => (
        <div key={i} className="space-y-1">
          {section.heading && (
            <p className="sidebar-label px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
              {section.heading}
            </p>
          )}
          {section.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`nav-link relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-500/10 text-brand-600 dark:text-brand-500"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-600" aria-hidden="true" />
                )}
                <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                <span className="sidebar-label">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-border p-3">
      <ThemeToggle />
      <div className="sidebar-label mt-1 rounded-lg px-3 py-2">
        <p className="truncate text-sm font-medium text-fg">{user.name}</p>
        <p className="truncate text-xs text-faint">{user.email}</p>
        <p className="mt-1 text-[11px] font-medium text-brand-600">{ROLE_LABELS[user.role]}</p>
      </div>
      <form action="/api/auth/logout" method="post">
        <button className="sidebar-compact btn-secondary mt-1 w-full text-sm" title="Sign out">
          <Icon name="log-out" className="h-[18px] w-[18px] shrink-0" />
          <span className="sidebar-label">Sign out</span>
        </button>
      </form>
    </div>
  );

  const menuIcon = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );

  return (
    <>
      {/* Mobile top bar — logo on the left, menu button on the right (the drawer
          slides in from the right to match). */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Logo />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2">
          {menuIcon}
        </button>
      </header>

      {/* Mobile drawer + overlay (always full labels — not an .app-sidebar).
          Anchored right to match the menu button. */}
      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-border bg-surface transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Logo />
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {navList}
        {footer}
      </aside>

      {/* Desktop sidebar — collapsible icon rail */}
      <aside className="app-sidebar hidden shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="sidebar-header flex h-16 items-center justify-between gap-2 border-b border-border px-4">
          <Logo />
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Icon name={collapsed ? "chevrons-right" : "chevrons-left"} className="h-[18px] w-[18px]" />
          </button>
        </div>
        {navList}
        {footer}
      </aside>
    </>
  );
}
