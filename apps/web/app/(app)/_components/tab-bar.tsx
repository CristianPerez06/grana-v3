'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, List, MoreHorizontal, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useKeyboardOpen } from '@/lib/use-keyboard-open'
import { isActive } from '@/lib/nav'

type TabSlot = {
  href: string
  labelKey: 'dashboard' | 'movements' | 'home'
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
}

/**
 * Three tabs plus the menu button — the same four slots as the native tab bar
 * (`apps/mobile/components/layout/TabBar.tsx`), in the same order.
 *
 * Accounts, Cards and Settings hang off the menu instead of getting a slot.
 * That demotes them relative to the desktop sidebar, and is the accepted cost
 * of the two mobile experiences reading as one product.
 *
 * The shared destination is `/shared` on web and `home` on native. It uses the
 * `nav.home` label on both, so desktop and mobile do not call the same place
 * two different things (decision 5 of the change's design).
 */
const TAB_SLOTS: TabSlot[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: Home },
  { href: '/transactions', labelKey: 'movements', icon: List },
  { href: '/shared', labelKey: 'home', icon: Users },
]

export const TabBar = ({
  onOpenMenu,
  menuOpen,
}: {
  onOpenMenu: () => void
  menuOpen: boolean
}) => {
  const pathname = usePathname()
  const tNav = useTranslations('nav')
  const keyboardOpen = useKeyboardOpen()

  // Anchored to the bottom edge, the bar would sit on top of the keyboard — or
  // between it and the focused field, eating the room that field needs. It
  // offers nothing useful mid-edit, so it steps aside and returns on dismiss.
  // Native does the same, for the same reason (`TabBar.tsx:84-92`).
  if (keyboardOpen) return null

  return (
    <nav
      aria-label={tNav('open_menu')}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-1 rounded-t-xl border-t border-border-soft bg-card px-3 pt-[14px] pb-[max(14px,var(--safe-bottom))] md:hidden"
    >
      {TAB_SLOTS.map((slot) => (
        <Tab
          key={slot.href}
          slot={slot}
          label={tNav(slot.labelKey)}
          // With the menu open no tab reads as active, even though the route
          // behind it still belongs to one.
          active={!menuOpen && isActive(pathname, slot.href)}
        />
      ))}
      <MenuButton label={tNav('more_options')} onPress={onOpenMenu} active={menuOpen} />
    </nav>
  )
}

const Tab = ({
  slot,
  label,
  active,
}: {
  slot: TabSlot
  label: string
  active: boolean
}) => {
  const Icon = slot.icon
  return (
    <Link
      href={slot.href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${
        active ? 'text-positive' : 'text-text-soft'
      }`}
    >
      {/* Indicator rail. Always in the layout, transparent when inactive, so
          switching tabs never shifts the icons by 3px. */}
      <span
        aria-hidden
        className={`h-[3px] w-6 rounded-full ${active ? 'bg-positive' : 'bg-transparent'}`}
      />
      <Icon size={22} strokeWidth={1.9} />
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </Link>
  )
}

const MenuButton = ({
  label,
  onPress,
  active,
}: {
  label: string
  onPress: () => void
  active: boolean
}) => (
  <div className="flex flex-1 items-center justify-center py-1">
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      aria-expanded={active}
      className={`flex size-[52px] cursor-pointer items-center justify-center rounded-full bg-positive text-white transition-shadow ${
        active ? 'ring-4 ring-positive/25' : ''
      }`}
    >
      <MoreHorizontal size={26} strokeWidth={2} />
    </button>
  </div>
)
