'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { CreateRecurrenceButton } from './create-recurrence-button'

/**
 * Chrome del root de /transactions/recurring. El layout monta este componente
 * en toda ruta bajo /transactions/recurring/**; solo se renderiza en el root
 * (`/transactions/recurring`) para evitar el doble-header con /[id].
 */
export const RecurrencesHeader = () => {
  const pathname = usePathname()
  const tRec = useTranslations('recurrences')

  if (pathname !== '/transactions/recurring') return null

  return (
    <PageHeader
      title={tRec('title')}
      description={tRec('description')}
      backLink={{ href: '/transactions', label: tRec('back_label') }}
      actions={<CreateRecurrenceButton />}
    />
  )
}
