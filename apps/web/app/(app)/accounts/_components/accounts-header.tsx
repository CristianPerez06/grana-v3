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
  // The layout renders this header on every /accounts/* route; the create CTA
  // only belongs on the list root (detail already has its own actions).
  const isListRoot = pathname === '/accounts'
  const [institutions, setInstitutions] = useState<Institution[] | null>(null)

  useEffect(() => {
    // Institutions only feed the create-account drawer; skip off the list root.
    if (!isListRoot) return

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
  }, [isListRoot])

  return (
    <PageHeader
      title={t('title')}
      actions={
        isListRoot ? (
          <CreateAccountButton
            institutions={institutions ?? []}
            disabled={institutions == null}
          />
        ) : undefined
      }
    />
  )
}
