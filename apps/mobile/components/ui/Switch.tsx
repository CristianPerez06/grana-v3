import { Switch as RNSwitch } from 'react-native'
import type { SwitchProps } from '@grana/ui-contracts'
import { colors } from '../../lib/colors'

/**
 * On/off switch. Wraps the native RN Switch with the design-system colors.
 * Mirrors apps/web/components/ui/switch.tsx via the shared SwitchProps contract.
 */
export function Switch({
  checked,
  onValueChange,
  disabled = false,
  ariaLabel,
}: SwitchProps) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.borderSoft, true: colors.positive }}
      thumbColor={colors.white}
      ios_backgroundColor={colors.borderSoft}
      accessibilityRole="switch"
      accessibilityLabel={ariaLabel}
      accessibilityState={{ checked, disabled }}
    />
  )
}
