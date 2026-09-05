import { Text, View } from 'react-native'
import { Switch } from '../ui/Switch'
import { useT } from '../../lib/locale-context'

type Props = {
  checked: boolean
  onChange: (checked: boolean) => void
  /**
   * The category already belongs to the household. The switch stays on and
   * cannot be turned off: other members may already point movements at it, so
   * the way back to "own" is not offered (spec `categories`).
   */
  locked?: boolean
}

/**
 * "Es del hogar" row of the category form. Rendered only when the user has an
 * active household. Mirrors the web `household-scope-field.tsx`.
 */
export function HouseholdScopeRow({ checked, onChange, locked = false }: Props) {
  const t = useT()

  return (
    <View className="flex-row items-start justify-between gap-4 rounded-[14px] border border-border bg-card px-4 py-3">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text">
          {t('settings.categories.form.household_label')}
        </Text>
        <Text className="mt-0.5 text-xs text-text-muted">
          {locked
            ? t('settings.categories.form.household_locked')
            : t('settings.categories.form.household_help')}
        </Text>
      </View>
      <Switch
        checked={checked}
        onValueChange={onChange}
        disabled={locked}
        ariaLabel={t('settings.categories.form.household_label')}
      />
    </View>
  )
}
