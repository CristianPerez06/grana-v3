'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import type { Institution } from '@/lib/accounts/types'
import { CreateAccountButton } from './create-account-button'

export const AccountsHeader = () => {
  const t = useTranslations('accounts')
  const pathname = usePathname()
  const [institutions, setInstitutions] = useState<Institution[] | null>(null)

  useEffect(() => {
    if (pathname !== '/accounts') return

    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('is_active', true)
        .order('user_id', { ascending: true, nullsFirst: true })
        .order('name', { ascending: true })

      if (cancelled || error || !data) return
      setInstitutions(data)
    })()

    return () => {
      cancelled = true
    }
  }, [pathname])

  // El layout monta este header en toda ruta bajo /accounts/**;
  // solo lo renderizamos en el root para evitar el doble-header con las pages hijas.
  if (pathname !== '/accounts') return null

  return (
    <PageHeader
      title={t('title')}
      actions={
        <CreateAccountButton
          institutions={institutions ?? []}
          disabled={institutions == null}
        />
      }
    />
  )
}
