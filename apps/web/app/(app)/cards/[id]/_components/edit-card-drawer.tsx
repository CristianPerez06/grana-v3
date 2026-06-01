'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/drawer'
import { EditCardForm, type EditCardFormProps } from './edit-card-form'

type EditCardDrawerContextValue = { openEdit: () => void }

const EditCardDrawerContext = createContext<EditCardDrawerContextValue | null>(null)

/**
 * Opens the "Editar tarjeta" drawer. Returns null outside the provider (e.g. the
 * archived-card branch, which has no edit affordance) so consumers can opt out
 * with optional chaining rather than crashing.
 */
export const useEditCardDrawer = (): EditCardDrawerContextValue | null =>
  useContext(EditCardDrawerContext)

// The form props minus the chrome wiring the provider owns itself.
type CardData = Omit<EditCardFormProps, 'variant' | 'onClose' | 'onSuccess'>

type Props = {
  card: CardData
  children: ReactNode
}

/**
 * Hosts the edit-card form in a right-side drawer over the card detail, reusing
 * the same Drawer primitive + form chrome as "Registrar movimiento". The
 * `/cards/[id]/edit` page route stays as the no-JS / deep-link fallback.
 */
export function EditCardDrawerProvider({ card, children }: Props) {
  const t = useTranslations('cards')
  const [open, setOpen] = useState(false)
  // Bump on each open so the form remounts to a clean (re-prefilled) state.
  const [formInstance, setFormInstance] = useState(0)

  const openEdit = useCallback(() => {
    setFormInstance((n) => n + 1)
    setOpen(true)
  }, [])

  return (
    <EditCardDrawerContext.Provider value={{ openEdit }}>
      {children}
      <Drawer open={open} onClose={() => setOpen(false)} widthPx={540} ariaLabel={t('edit.title')}>
        <EditCardForm
          key={formInstance}
          {...card}
          variant="drawer"
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      </Drawer>
    </EditCardDrawerContext.Provider>
  )
}
