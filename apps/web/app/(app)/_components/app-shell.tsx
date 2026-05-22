"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/_actions/logout";
import { setSidebarCollapsed as setSidebarCollapsedAction } from "@/app/_actions/preferences";

type NavItem = {
  href: string;
  labelKey: "dashboard" | "accounts" | "cards" | "movements";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/accounts", labelKey: "accounts", icon: Wallet },
  { href: "/cards", labelKey: "cards", icon: CreditCard },
  { href: "/transactions", labelKey: "movements", icon: List },
];

const isActive = (pathname: string, href: string) => {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
};

const findActiveHref = (pathname: string) => {
  let best: string | null = null;
  for (const item of PRIMARY_NAV) {
    if (!isActive(pathname, item.href)) continue;
    if (best === null || item.href.length > best.length) best = item.href;
  }
  if (
    isActive(pathname, "/settings") &&
    (best === null || "/settings".length > best.length)
  ) {
    best = "/settings";
  }
  return best;
};

export const AppShell = ({
  children,
  initialCollapsed,
}: {
  children: React.ReactNode;
  initialCollapsed: boolean;
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => {
      void setSidebarCollapsedAction(next);
    });
  };

  return (
    <div className="flex h-full flex-1 flex-col md:flex-row md:overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <TopBarMobile onOpenDrawer={() => setDrawerOpen(true)} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-8 md:overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

const Sidebar = ({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) => {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);

  return (
    <aside
      aria-label="Menú lateral"
      className={`relative hidden shrink-0 md:flex md:flex-col md:gap-1 md:my-3 md:ml-3 md:rounded-3xl md:border md:border-border-soft md:bg-card md:py-5 md:shadow-sm md:transition-[width] md:duration-200 ${
        collapsed ? "md:w-16" : "md:w-64"
      }`}
    >
      <SidebarContent activeHref={activeHref} collapsed={collapsed} />
      <SidebarEdgeToggle collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
};

const SidebarEdgeToggle = ({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) => {
  const tNav = useTranslations("nav");
  const label = collapsed ? tNav("expand_sidebar") : tNav("collapse_sidebar");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="absolute top-7 -right-3.5 z-10 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border-soft bg-card text-text-soft shadow-sm transition-colors hover:bg-page hover:text-text md:flex"
    >
      {collapsed ? (
        <ChevronRight size={16} strokeWidth={2} />
      ) : (
        <ChevronLeft size={16} strokeWidth={2} />
      )}
    </button>
  );
};

const SidebarContent = ({
  activeHref,
  collapsed,
  onNavigate,
}: {
  activeHref: string | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) => {
  const tNav = useTranslations("nav");

  return (
    <>
      <div
        className={`mb-2 flex items-center ${collapsed ? "justify-center px-2" : "px-5"}`}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="grana"
          className="text-2xl font-bold tracking-tight text-navy"
        >
          {collapsed ? "g" : "grana"}
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-[2px] overflow-y-auto px-2">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={tNav(item.labelKey)}
            active={activeHref === item.href}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mx-3 my-3 shrink-0 border-t border-border-soft" />

      <nav className="flex shrink-0 flex-col gap-[2px] px-2 pb-1">
        <SidebarLink
          href="/settings"
          icon={Settings}
          label={tNav("settings")}
          active={activeHref === "/settings"}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <LogoutButton label={tNav("logout")} collapsed={collapsed} />
      </nav>
    </>
  );
};

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>;

const SidebarLink = ({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: IconType;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) => (
  <Link
    href={href}
    onClick={onNavigate}
    aria-current={active ? "page" : undefined}
    aria-label={collapsed ? label : undefined}
    title={collapsed ? label : undefined}
    className={`flex items-center gap-3 rounded-[var(--radius-xl)] py-[11px] text-[14px] font-semibold transition-colors ${
      collapsed ? "justify-center px-0" : "px-4"
    } ${active ? "bg-positive/8 text-positive" : "text-text hover:bg-page"}`}
  >
    <Icon size={20} strokeWidth={1.9} />
    {!collapsed && <span>{label}</span>}
  </Link>
);

const LogoutButton = ({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) => (
  <form action={logoutAction}>
    <button
      type="submit"
      aria-label={label}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-3 rounded-[var(--radius-xl)] py-[11px] text-left text-[14px] font-semibold text-error transition-colors hover:bg-error/8 ${
        collapsed ? "justify-center px-0" : "px-4"
      }`}
    >
      <LogOut size={20} strokeWidth={1.9} />
      {!collapsed && <span>{label}</span>}
    </button>
  </form>
);

const TopBarMobile = ({ onOpenDrawer }: { onOpenDrawer: () => void }) => {
  const tNav = useTranslations("nav");
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border-soft bg-card px-4 py-3 md:hidden">
      <button
        type="button"
        onClick={onOpenDrawer}
        aria-label={tNav("open_menu")}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-text-soft transition-colors hover:bg-page hover:text-text"
      >
        <Menu size={22} strokeWidth={1.9} />
      </button>
      <Link
        href="/dashboard"
        className="text-xl font-bold tracking-tight text-navy"
      >
        grana
      </Link>
    </header>
  );
};

const Drawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);
  const tNav = useTranslations("nav");
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={[
        "m-0 h-full max-h-none w-screen max-w-none bg-card p-0 text-text md:hidden",
        "-translate-x-full opacity-0 open:translate-x-0 open:opacity-100",
        "starting:open:-translate-x-full starting:open:opacity-0",
        "transition-[transform,opacity,display,overlay] duration-200 ease-out transition-discrete",
        "motion-reduce:transition-none",
        "backdrop:bg-black/40 backdrop:opacity-0 open:backdrop:opacity-100",
        "starting:open:backdrop:opacity-0",
        "backdrop:transition-[opacity,display,overlay] backdrop:duration-200 backdrop:transition-discrete",
        "motion-reduce:backdrop:transition-none",
      ].join(" ")}
    >
      <div className="flex h-full flex-col py-5">
        <div className="flex items-center justify-between px-4">
          <span className="sr-only">{tNav("open_menu")}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={tNav("close_menu")}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-text-soft transition-colors hover:bg-page hover:text-text cursor-pointer"
          >
            <X size={20} strokeWidth={1.9} />
          </button>
        </div>
        <SidebarContent
          activeHref={activeHref}
          collapsed={false}
          onNavigate={onClose}
        />
      </div>
    </dialog>
  );
};
