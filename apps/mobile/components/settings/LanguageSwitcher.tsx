import { Pressable, Text, View } from 'react-native'
import type { LanguageSwitcherProps } from '@grana/ui-contracts'

export function LanguageSwitcher<TLocale extends string>({
  current,
  locales,
  onSelect,
  disabled = false,
  renderLabel,
  ariaLabel,
}: LanguageSwitcherProps<TLocale>) {
  return (
    <View
      className="flex-row items-center gap-1"
      accessibilityLabel={ariaLabel}
      accessibilityRole="radiogroup"
    >
      {locales.map((locale) => {
        const isActive = current === locale
        return (
          <Pressable
            key={locale}
            onPress={() => {
              if (isActive || disabled) return
              onSelect(locale)
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive, disabled }}
            className={`rounded-md px-3 py-1.5 ${
              isActive ? 'bg-border-soft' : ''
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <Text
              className={`text-sm ${
                isActive ? 'font-semibold text-text' : 'text-text-soft'
              }`}
            >
              {renderLabel(locale)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
