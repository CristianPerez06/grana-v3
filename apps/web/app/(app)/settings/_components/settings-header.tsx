'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Header del segmento /settings. El layout lo monta en todas las rutas bajo
 * /settings/**, pero solo renderiza contenido cuando estamos en /settings exacto.
 * En sub-rutas (/settings/categories/**) retorna null para evitar el doble-header
 * con el CategoriesHeader que monta su propio segmento.
 */
export const SettingsHeader = () => {
  const t = useTranslations('settings')
  const tNav = useTranslations('nav')
  const pathname = usePathname()
  if (pathname !== '/settings') return null
  return (
    <PageHeader
      title={t('title')}
      // Root screen of a chromeless section: below `md` this route renders
      // without a tab bar, so this link is the only visible way out. Fixed href
      // over `router.back()` so the destination is the same coming from the
      // menu, a deep link or a dashboard card.
      backLink={{ href: '/dashboard', label: tNav('dashboard') }}
    />
  )
}
