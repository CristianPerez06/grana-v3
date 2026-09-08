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
      // The ghost variant is tuned for light surfaces, and this button now sits
      // on the balance card's dark zone at EVERY width — not on the navy band
      // below `md` only — so the white icon is unconditional. Native solves it
      // the same way (`apps/mobile/components/dashboard/EyeMaskToggle.tsx`).
      className="text-white/70 hover:bg-navy-soft hover:text-white"
    >
      <Icon size={18} />
    </Button>
  )
}
