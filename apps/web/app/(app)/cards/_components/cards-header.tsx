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
  const tNav = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()

  const monthLabel = getTodayAR().toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  const [count, setCount] = useState<number | null>(null)
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null)

  useEffect(() => {
    if (pathname !== '/cards') return

    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const [countResult, institutionsResult, networksResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'credit')
          .eq('is_active', true),
        supabase
          .from('institutions')
          .select('*')
          .eq('is_active', true)
          .order('user_id', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true }),
        supabase
          .from('card_networks')
          .select('id, slug, name, brand_color, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ])

      if (cancelled) return

      if (!countResult.error && countResult.count != null) {
        setCount(countResult.count)
      }

      if (
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
  }, [pathname])

  // El layout monta este header en toda ruta bajo /cards/**;
  // solo lo renderizamos en el root para evitar el doble-header con las pages hijas.
  if (pathname !== '/cards') return null

  const description =
    count == null
      ? tRoute('subtitle_loading', { month: monthLabel })
      : t('wallet.subtitle', { count, month: monthLabel })

  return (
    <PageHeader
      title={t('title')}
      description={description}
      // Root screen of a chromeless section: below `md` this route renders
      // without a tab bar, so this link is the only visible way out. Fixed href
      // over `router.back()` so the destination is the same coming from the
      // menu, a deep link or a dashboard card.
      backLink={{ href: '/dashboard', label: tNav('dashboard') }}
      actions={
        <AddCardButton
          institutions={catalogs?.institutions ?? []}
          networks={catalogs?.networks ?? []}
          disabled={catalogs == null}
        />
      }
    />
  )
}
