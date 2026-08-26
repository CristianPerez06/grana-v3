"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  List,
  LogOut,
  PiggyBank,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/_actions/logout";
import { setSidebarCollapsed as setSidebarCollapsedAction } from "@/app/_actions/preferences";
import { GranaIsotype, GranaLogo } from "@/components/ui/grana-logo";
import { MovementDrawerLoader } from "@/app/(app)/transactions/_components/movement-drawer-loader";
import { AppMenu } from "./app-menu";
import { ProfileBlock } from "./profile-block";
import { TabBar } from "./tab-bar";
import { isActive, isChromeless } from "@/lib/nav";

type NavItem = {
  href: string;
  labelKey: "dashboard" | "accounts" | "cards" | "movements" | "home" | "savings";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
};

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/accounts", labelKey: "accounts", icon: Wallet },
  { href: "/cards", labelKey: "cards", icon: CreditCard },
  { href: "/transactions", labelKey: "movements", icon: List },
  { href: "/savings", labelKey: "savings", icon: PiggyBank },
  // `nav.home` ("Hogar"), not `nav.shared` ("Compartido"): the tab bar and this
  // sidebar point at the same place, so they say the same word.
  { href: "/shared", labelKey: "home", icon: Users },
];

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
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  initialCollapsed: boolean;
  userName: string | null;
  userEmail: string | null;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [, startTransition] = useTransition();
  const pathname = usePathname();

  // Sections reached from the menu, and full-screen flows, render bare. The
  // decision lives here rather than inside `TabBar` because the FAB and the
  // content padding need the same answer — see `--tab-bar-inset` below.
  const showTabBar = !isChromeless(pathname);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => {
      void setSidebarCollapsedAction(next);
    });
  };

  return (
    <div
      className="flex h-full flex-1 flex-col overflow-hidden md:flex-row"
      // How much room the fixed tab bar takes at the bottom edge: its own
      // height (52px button + 14px of top padding + 20px of labels) plus the
      // safe-area allowance. Zero where the bar does not render, so chromeless
      // sections do not carry dead space.
      //
      // Published as a variable because two things out of the bar's control
      // need it: the content wrapper, so the last rows are not covered, and
      // `Fab`, which is a `components/ui/` primitive with no business knowing
      // about app navigation.
      style={
        {
          '--tab-bar-inset': showTabBar
            ? 'calc(86px + max(14px, var(--safe-bottom)))'
            : '0px',
        } as React.CSSProperties
      }
    >
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} userName={userName} userEmail={userEmail} />
      {/* `min-h-0 overflow-y-auto` (not gated to `md`) makes <main> the scroll
          container on mobile too — otherwise the 100vh-locked shell leaves tall
          content (e.g. an expanded card group) unreachable with no scrollbar. */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <MovementDrawerLoader>
          {/* ⚠️ `px-4 py-5` is mirrored by `PageHeader`'s `-mx-4 -mt-5`, which
              is how the navy band goes full-bleed below `md` from inside this
              padded wrapper. The two have to move together: change these values
              and the band stops reaching the viewport edges, silently.

              The bottom padding clears the fixed tab bar, which is out of flow
              and would otherwise sit on top of the last rows of content. */}
          <div className="mx-auto w-full max-w-5xl px-4 pt-5 pb-[calc(1.25rem+var(--tab-bar-inset,0px))] md:px-8 md:py-8">
            {children}
          </div>
        </MovementDrawerLoader>
      </main>
      {showTabBar && <TabBar onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />}
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userEmail={userEmail}
      />
    </div>
  );
};

const Sidebar = ({
  collapsed,
  onToggle,
  userName,
  userEmail,
}: {
  collapsed: boolean;
  onToggle: () => void;
  userName: string | null;
  userEmail: string | null;
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
      <SidebarContent activeHref={activeHref} collapsed={collapsed} userName={userName} userEmail={userEmail} />
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
      className="absolute top-6 -right-4 z-10 hidden h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border-soft bg-card text-text-soft shadow-sm transition-colors hover:bg-page hover:text-text md:flex"
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
  userName,
  userEmail,
}: {
  activeHref: string | null;
  collapsed: boolean;
  userName: string | null;
  userEmail: string | null;
}) => {
  const tNav = useTranslations("nav");

  return (
    <>
      <div
        className={`mb-2 flex shrink-0 items-center ${collapsed ? "justify-center px-2" : "px-5"}`}
      >
        <Link
          href="/dashboard"
          aria-label="grana"
          className="flex items-center"
        >
          <div className="h-[40px] flex items-center justify-center">
            {collapsed ? <GranaIsotype size={32} /> : <GranaLogo width={116} />}
          </div>
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
          />
        ))}
      </nav>

      <div className="mx-3 my-3 shrink-0 border-t border-border-soft" />

      <ProfileBlock name={userName} email={userEmail} collapsed={collapsed} />

      <nav className="flex shrink-0 flex-col gap-[2px] px-2 pb-1">
        <SidebarLink
          href="/settings"
          icon={Settings}
          label={tNav("settings")}
          active={activeHref === "/settings"}
          collapsed={collapsed}
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
}: {
  href: string;
  icon: IconType;
  label: string;
  active: boolean;
  collapsed: boolean;
}) => (
  <Link
    href={href}
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
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-xl)] py-[11px] text-left text-[14px] font-semibold text-error transition-colors hover:bg-error/8 ${
        collapsed ? "justify-center px-0" : "px-4"
      }`}
    >
      <LogOut size={20} strokeWidth={1.9} />
      {!collapsed && <span>{label}</span>}
    </button>
  </form>
);
