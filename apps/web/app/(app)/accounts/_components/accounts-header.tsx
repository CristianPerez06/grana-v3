'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import type { Institution } from '@/lib/accounts/types'
import { CreateAccountButton } from './create-account-button'

export const AccountsHeader = () => {
  const t = useTranslations('accounts')
  const [institutions, setInstitutions] = useState<Institution[] | null>(null)

  useEffect(() => {
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
  }, [])

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
