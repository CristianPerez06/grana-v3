import { useState } from 'react'
import { Pressable, View, type TextInputProps } from 'react-native'
import { Eye, EyeOff } from 'lucide-react-native'
import type { PasswordFieldProps } from '@grana/ui-contracts'
import { colors } from '../../lib/colors'
import { FormField } from './FormField'

type MobilePasswordFieldProps = PasswordFieldProps & TextInputProps

export function PasswordField({
  toggleLabelShow = 'Ver',
  toggleLabelHide = 'Ocultar',
  className,
  ...props
}: MobilePasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <View className="relative">
      <FormField
        secureTextEntry={!visible}
        className={`pr-10 ${className ?? ''}`}
        {...props}
      />
      {/* `top-7` centers the 28px button on the 44px input below the 14px
          leading-none label + 6px gap — mirrors the web PasswordField. */}
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? toggleLabelHide : toggleLabelShow}
        hitSlop={8}
        className="absolute right-2 top-7 h-7 w-7 items-center justify-center"
      >
        <Icon size={18} color={colors.textSoft} />
      </Pressable>
    </View>
  )
}
