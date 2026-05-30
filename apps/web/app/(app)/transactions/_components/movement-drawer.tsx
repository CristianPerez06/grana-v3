'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { MovementDrawerContext } from '@/lib/transactions/movement-drawer-context'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { MovementForm, type MovementFormAccount } from '../new/_components/movement-form'

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  children: ReactNode
}

/**
 * Hosts the movement create form in a right-side drawer over the list, reusing
 * the exact same MovementForm (and its server actions/validation) as the
 * `/transactions/new` page. The page route stays as a deep-link/no-JS fallback.
 */
export function MovementDrawerProvider({ accounts, categories, children }: Props) {
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
          preselectAccountId={preselectAccountId}
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </MovementDrawerContext.Provider>
  )
}
