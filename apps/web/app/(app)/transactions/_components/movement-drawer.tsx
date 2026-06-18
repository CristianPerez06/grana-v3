'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { MovementDrawerContext } from '@/lib/transactions/movement-drawer-context'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import type { Household } from '@/lib/shared/types'
import { MovementForm, type MovementFormAccount } from '@/lib/transactions/components/movement-form'

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  household?: Household | null
  showFirstMovementGuidance?: boolean
  children: ReactNode
}

/**
 * Hosts the movement create form in a right-side drawer over the current page.
 * Mounted by `MovementDrawerLoader` inside `AppShell`, so the drawer is
 * accessible from any authenticated route. The drawer is the only host for the
 * create flow — there is no equivalent page route.
 */
export function MovementDrawerProvider({
  accounts,
  categories,
  household,
  showFirstMovementGuidance = false,
  children,
}: Props) {
  const t = useTranslations('transactions')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preselectAccountId, setPreselectAccountId] = useState<string | undefined>(
    undefined,
  )
  // Bump on each open so the form remounts to a clean create state.
  const [formInstance, setFormInstance] = useState(0)

  const openCreate = useCallback((accountId?: string) => {
    setPreselectAccountId(accountId)
    setFormInstance((n) => n + 1)
    setOpen(true)
  }, [])

  // Bridge: open the create drawer when arriving with `?nuevo=1` (e.g. from the
  // onboarding closing screen, which lives in another route group and can't
  // reach this context directly). This provider only mounts once the drawer's
  // data is ready, so by the time this effect runs the form can mount — if the
  // param is present before that, it survives in the URL until we get here.
  // We clean the param immediately so a refresh or back-nav doesn't reopen it.
  const bridgedRef = useRef(false)
  useEffect(() => {
    if (bridgedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('nuevo') !== '1') return
    bridgedRef.current = true
    // Intentional: bridge the URL param to drawer state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreate()
    params.delete('nuevo')
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [openCreate, router])

  return (
    <MovementDrawerContext.Provider value={{ openCreate }}>
      {children}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={t('actions.register_movement')}
      >
        <MovementForm
          key={formInstance}
          variant="drawer"
          accounts={accounts}
          categories={categories}
          household={household}
          showFirstMovementGuidance={showFirstMovementGuidance}
          preselectAccountId={preselectAccountId}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </MovementDrawerContext.Provider>
  )
}
