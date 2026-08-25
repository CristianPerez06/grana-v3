'use client'

import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

type FabProps = {
  onClick?: () => void
  /** Accessible label (the FAB shows only an icon). */
  label: string
  disabled?: boolean
  /** Defaults to a Plus glyph. */
  icon?: ReactNode
}

/**
 * Floating action button for a page's PRIMARY action on mobile. Desktop keeps
 * the header CTA, so the FAB is `md:hidden`; the paired header button must be
 * `hidden md:inline-flex` so exactly one of them shows at any width. The two
 * gates have to match: at `sm` they used to leave 640–767px with neither the
 * FAB nor the sidebar, and flipping only one of them would show both instead.
 *
 * Fixed to the viewport bottom-right, above the scrolling content (`z-40`), and
 * lifted clear of the tab bar by `--tab-bar-inset` — published by `AppShell`,
 * and `0px` on the chromeless sections that render no bar.
 */
export const Fab = ({ onClick, label, disabled = false, icon }: FabProps) => (
  <Button
    variant="primary"
    size="fab"
    aria-label={label}
    title={label}
    className="fixed right-10 bottom-[calc(2.5rem+var(--tab-bar-inset,0px))] z-40 md:hidden"
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
  >
    {icon ?? <Plus className="size-7" aria-hidden />}
  </Button>
)
