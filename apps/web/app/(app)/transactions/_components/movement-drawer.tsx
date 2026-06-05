'use client'

import { useCallback, useState, type ReactNode } from 'react'
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
  children: ReactNode
}

/**
 * Hosts the movement create form in a right-side drawer over the current page.
 * Mounted by `MovementDrawerLoader` inside `AppShell`, so the drawer is
 * accessible from any authenticated route. The drawer is the only host for the
 * create flow — there is no equivalent page route.
 */
export function MovementDrawerProvider({ accounts, categories, household, children }: Props) {
  const t = useTranslations('transactions')
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
          preselectAccountId={preselectAccountId}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </MovementDrawerContext.Provider>
  )
}
