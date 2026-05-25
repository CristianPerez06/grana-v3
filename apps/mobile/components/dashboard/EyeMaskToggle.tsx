import { Pressable } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { useEyeMask } from './EyeMaskContext'

export const EyeMaskToggle = () => {
  const t = useT()
  const { masked, toggle } = useEyeMask()
  const Icon = masked ? EyeOff : Eye
  const label = masked ? t('dashboard.mask_show') : t('dashboard.mask_hide')

  return (
    <Pressable
      onPress={toggle}
      accessibilityLabel={label}
      accessibilityRole="button"
      className="h-9 w-9 items-center justify-center rounded-full"
    >
      <Icon size={18} color="#6B7683" />
    </Pressable>
  )
}
