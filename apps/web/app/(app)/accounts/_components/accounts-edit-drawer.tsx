'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { EditAccountForm } from '../[id]/edit/_components/edit-account-form'
import type { AccountWithDetails, Institution } from '@/lib/accounts/types'

type AccountsEditDrawerContextValue = { openEdit: (account: AccountWithDetails) => void }

const AccountsEditDrawerContext = createContext<AccountsEditDrawerContextValue | null>(null)

/** Opens the "Editar cuenta" drawer from a list row. Null outside the provider so rows fall back to the /edit route. */
export const useAccountsEditDrawer = (): AccountsEditDrawerContextValue | null =>
  useContext(AccountsEditDrawerContext)

type Props = {
  institutions: Institution[]
  children: ReactNode
}

/**
 * Hosts a single edit-account drawer over the accounts list so every row's
 * "Editar" opens the same drawer the detail page uses — no full-page nav to
 * `/accounts/[id]/edit`. The row passes its own account into `openEdit`; the
 * `/edit` route stays as the no-JS / deep-link fallback. The form remounts on
 * each open (`key`) so it re-prefills cleanly for whichever account is edited.
 */
export function AccountsEditDrawerProvider({ institutions, children }: Props) {
  const t = useTranslations('accounts')
  const [editing, setEditing] = useState<AccountWithDetails | null>(null)
  const [formInstance, setFormInstance] = useState(0)

  const openEdit = useCallback((account: AccountWithDetails) => {
    setFormInstance((n) => n + 1)
    setEditing(account)
  }, [])

  return (
    <AccountsEditDrawerContext.Provider value={{ openEdit }}>
      {children}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        widthPx={540}
        ariaLabel={t('edit_title')}
      >
        {editing && (
          <EditAccountForm
            key={formInstance}
            account={editing}
            institutions={institutions}
            variant="drawer"
            onClose={() => setEditing(null)}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Drawer>
    </AccountsEditDrawerContext.Provider>
  )
}
