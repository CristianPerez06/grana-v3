import { useState } from 'react'
import { Pressable, Text, View, type TextInputProps } from 'react-native'
import { FormField } from './FormField'

type Props = TextInputProps & {
  label: string
  error?: string
  toggleLabelShow?: string
  toggleLabelHide?: string
}

export function PasswordField({
  toggleLabelShow = 'Ver',
  toggleLabelHide = 'Ocultar',
  ...props
}: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <View className="relative">
      <FormField
        secureTextEntry={!visible}
        {...props}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel={visible ? toggleLabelHide : toggleLabelShow}
        className="absolute right-2 top-7"
      >
        <Text className="text-xs font-medium text-text-muted">
          {visible ? toggleLabelHide : toggleLabelShow}
        </Text>
      </Pressable>
    </View>
  )
}
