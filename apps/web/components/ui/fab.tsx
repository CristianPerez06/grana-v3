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
 * Floating action button, `md:hidden`, fixed to the viewport bottom-right above
 * the scrolling content (`z-40`) and lifted clear of the tab bar by
 * `--tab-bar-inset` — published by `AppShell`, and `0px` on the chromeless
 * sections that render no bar.
 *
 * **The only FAB in the product is `QuickAddFab`** — registering a movement,
 * on the three tab roots. That is the rule native follows and web now matches:
 * a create action for the entity a route lists (an account, a card, a
 * category, a recurrence) goes in the `PageHeader`'s `actions` slot, visible at
 * every width, never behind a floating button. A route's own primary create
 * action is part of its chrome, and chrome does not change shape by viewport.
 *
 * So: do not reach for this for a new route's create button. If a second FAB
 * ever looks warranted, that is the conversation to have first.
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
