/**
 * Navigation rules shared by the desktop sidebar and the mobile tab bar, so the
 * two never drift on what counts as "the active section".
 */

export const isActive = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Whole sections that render without a tab bar — exactly the ones reached from
 * the menu. None of them is a tab, so the bar would only show up detached, with
 * no slot highlighted.
 *
 * Hiding it is half the contract. The other half: every section listed here
 * MUST declare a `backLink` on its root route's `PageHeader`, or the screen is
 * left with no visible way out. Mirrors `CHROMELESS_SECTIONS` in
 * `apps/mobile/components/layout/TabBar.tsx`.
 */
const CHROMELESS_SECTIONS: readonly string[] = ['/accounts', '/cards', '/settings']

/**
 * Routes that live inside a tab's section but read as a dedicated full-screen
 * flow rather than a sub-view of the tab. Mirrors `CHROMELESS_SCREENS` in the
 * native tab bar — the `/shared` entries are its `home/*` ones, since mobile's
 * `home` section is web's `shared`.
 */
const CHROMELESS_SCREENS: readonly string[] = [
  '/transactions/new',
  '/shared/settle',
  '/shared/settings',
  '/shared/cuenta-corriente',
]

/** True where the tab bar must not render. */
export const isChromeless = (pathname: string) =>
  CHROMELESS_SECTIONS.some((section) => isActive(pathname, section)) ||
  CHROMELESS_SCREENS.some((screen) => isActive(pathname, screen))
