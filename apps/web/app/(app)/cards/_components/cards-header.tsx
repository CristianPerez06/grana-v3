'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'
import { createClient } from '@/lib/supabase/client'
import { getTodayAR } from '@/lib/date'
import type { Institution } from '@/lib/accounts/types'
import type { CardNetwork } from '@/lib/cards/queries'
import { AddCardButton } from './add-card-button'

type Catalogs = {
  institutions: Institution[]
  networks: CardNetwork[]
}

export const CardsHeader = () => {
  const t = useTranslations('cards')
  const tRoute = useTranslations('cards.route')
  const locale = useLocale()
  const pathname = usePathname()
  // The layout renders this header on every /cards/* route; the add-card CTA
  // only belongs on the wallet root (detail already has its own actions).
  const isWalletRoot = pathname === '/cards'

  const monthLabel = getTodayAR().toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  const [count, setCount] = useState<number | null>(null)
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const [countResult, institutionsResult, networksResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'credit')
          .eq('is_active', true),
        // Catalogs only feed the add-card drawer; skip them off the wallet root.
        isWalletRoot
          ? supabase
              .from('institutions')
              .select('*')
              .eq('is_active', true)
              .order('user_id', { ascending: true, nullsFirst: true })
              .order('name', { ascending: true })
          : null,
        isWalletRoot
          ? supabase
              .from('card_networks')
              .select('id, slug, name, brand_color, display_order')
              .eq('is_active', true)
              .order('display_order', { ascending: true })
          : null,
      ])

      if (cancelled) return

      if (!countResult.error && countResult.count != null) {
        setCount(countResult.count)
      }

      if (
        institutionsResult &&
        networksResult &&
        !institutionsResult.error &&
        !networksResult.error &&
        institutionsResult.data &&
        networksResult.data
      ) {
        setCatalogs({
          institutions: institutionsResult.data,
          networks: networksResult.data,
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isWalletRoot])

  const description =
    count == null
      ? tRoute('subtitle_loading', { month: monthLabel })
      : t('wallet.subtitle', { count, month: monthLabel })

  return (
    <PageHeader
      title={t('title')}
      description={description}
      actions={
        isWalletRoot ? (
          <AddCardButton
            institutions={catalogs?.institutions ?? []}
            networks={catalogs?.networks ?? []}
            disabled={catalogs == null}
          />
        ) : undefined
      }
    />
  )
}
