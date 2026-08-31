'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/ui/page-header'

export const SavingsHeader = () => {
  const tNav = useTranslations('nav')
  const pathname = usePathname()

  // El layout monta este header en toda ruta bajo /savings/**; solo se dibuja en
  // la raíz para no duplicarlo con las pages hijas, como hace `/accounts`.
  if (pathname !== '/savings') return null

  return (
    <PageHeader
      title={tNav('savings')}
      // Sección sin chrome por debajo de `md`: este enlace es la única salida
      // visible. Href fijo y no `router.back()`, para que el destino sea el
      // mismo llegando del menú, de un deep link o de la fila del dashboard.
      backLink={{ href: '/dashboard', label: tNav('dashboard') }}
    />
  )
}
