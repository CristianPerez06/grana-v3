'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { EditAccountForm } from '../edit/_components/edit-account-form'
import type { AccountWithDetails, Institution } from '@/lib/accounts/types'

type EditAccountDrawerContextValue = { openEdit: () => void }

const EditAccountDrawerContext = createContext<EditAccountDrawerContextValue | null>(null)

/** Opens the "Editar cuenta" drawer. Null outside the provider so consumers can opt out. */
export const useEditAccountDrawer = (): EditAccountDrawerContextValue | null =>
  useContext(EditAccountDrawerContext)

type Props = {
  account: AccountWithDetails
  institutions: Institution[]
  children: ReactNode
}

/**
 * Hosts the edit-account form in a right-side drawer over the account detail,
 * reusing the same Drawer primitive + form chrome as "Editar tarjeta" /
 * "Registrar movimiento". The `/accounts/[id]/edit` page route stays as the
 * no-JS / deep-link fallback. The form remounts on each open (`key`) so it
 * re-prefills cleanly.
 */
export function EditAccountDrawerProvider({ account, institutions, children }: Props) {
  const t = useTranslations('accounts')
  const [open, setOpen] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  const openEdit = useCallback(() => {
    setFormInstance((n) => n + 1)
    setOpen(true)
  }, [])

  return (
    <EditAccountDrawerContext.Provider value={{ openEdit }}>
      {children}
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('edit_title')}>
        <EditAccountForm
          key={formInstance}
          account={account}
          institutions={institutions}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </EditAccountDrawerContext.Provider>
  )
}
