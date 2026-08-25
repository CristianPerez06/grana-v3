'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useEyeMask } from './eye-mask-context'

type Props = {
  disabled?: boolean
}

export const EyeMaskToggle = ({ disabled = false }: Props) => {
  const t = useTranslations('dashboard')
  const { masked, toggle } = useEyeMask()
  const Icon = masked ? EyeOff : Eye
  const label = masked ? t('mask_show') : t('mask_hide')

  return (
    <Button
      variant="ghost"
      size="icon"
      onPress={toggle}
      disabled={disabled}
      aria-label={label}
      title={label}
      // The ghost variant is tuned for light surfaces, and below `md` this
      // button sits on the navy band of `DashboardHeader`, where `text-text-muted`
      // all but disappears. Native solves it the same way — a plain white icon
      // (`apps/mobile/components/dashboard/EyeMaskToggle.tsx`).
      className="text-white hover:bg-navy-soft md:text-text-muted md:hover:bg-border-soft"
    >
      <Icon size={18} />
    </Button>
  )
}
