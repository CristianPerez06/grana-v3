'use client'

import { useTranslations } from 'next-intl'
import { EyeMaskToggle } from './eye-mask-toggle'

export const DashboardHeader = () => {
  const t = useTranslations('dashboard')
  return (
    <header className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-semibold tracking-tight text-text">
        {t('title')}
      </h1>
      <EyeMaskToggle />
    </header>
  )
}
