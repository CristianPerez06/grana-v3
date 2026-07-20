'use client'

import { useMovementDrawer } from '@/lib/transactions/movement-drawer-context'
import { MonthNavigator } from '../../../dashboard/_components/month-navigator'
import { useSharedMonth } from './shared-month-context'

// Persistent month navigator for the Compartido home. Rendered outside the
// streamed body (in the layout), always visible from first paint; the arrows
// stay disabled until the app-shell movement drawer resolves — the same
// cold-load gate the register CTA uses — so the chrome never shifts. Reuses the
// dashboard's presentational MonthNavigator for pixel parity across routes.
export const SharedHomeHeader = () => {
  const { selected, goPrev, goNext } = useSharedMonth()
  const drawer = useMovementDrawer()
  const isDisabled = !drawer

  return (
    <div className="self-start">
      <MonthNavigator
        year={selected.year}
        month={selected.month}
        onPrev={isDisabled ? undefined : goPrev}
        onNext={isDisabled ? undefined : goNext}
      />
    </div>
  )
}
