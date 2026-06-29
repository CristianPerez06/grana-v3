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
 * the header CTA, so the FAB is `sm:hidden`; the paired header button should be
 * `hidden sm:inline-flex` so exactly one of them shows at any width. Fixed to
 * the viewport bottom-right, above the scrolling content (`z-40`).
 */
export const Fab = ({ onClick, label, disabled = false, icon }: FabProps) => (
  <Button
    variant="primary"
    size="fab"
    aria-label={label}
    title={label}
    className="fixed bottom-10 right-10 z-40 sm:hidden"
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
  >
    {icon ?? <Plus className="size-7" aria-hidden />}
  </Button>
)
