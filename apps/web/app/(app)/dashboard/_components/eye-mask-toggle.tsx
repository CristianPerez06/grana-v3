'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEyeMask } from './eye-mask-context'

export const EyeMaskToggle = () => {
  const t = useTranslations('dashboard')
  const { masked, toggle } = useEyeMask()
  const Icon = masked ? EyeOff : Eye
  const label = masked ? t('mask_show') : t('mask_hide')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border-soft hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon size={18} />
    </button>
  )
}
