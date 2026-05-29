'use client'

import { createContext, useContext } from 'react'

export type MovementDrawerContextValue = {
  /** Open the drawer in create mode, optionally pre-selecting an account. */
  openCreate: (preselectAccountId?: string) => void
}

/**
 * Shared context for the movement create/edit drawer. Lives in `lib` (not in
 * the route group) so consumers like the FAB and the header CTA can read it
 * without importing app-route code. The provider that supplies the value (and
 * mounts the form) lives at app/(app)/transactions/_components/movement-drawer.
 */
export const MovementDrawerContext =
  createContext<MovementDrawerContextValue | null>(null)

/** Returns null when rendered outside the provider (e.g. the dashboard FAB). */
export function useMovementDrawer(): MovementDrawerContextValue | null {
  return useContext(MovementDrawerContext)
}
