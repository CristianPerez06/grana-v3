import { Text, View } from 'react-native'
import {
  Banknote,
  Briefcase,
  Building2,
  Car,
  Coins,
  CreditCard,
  DollarSign,
  Gift,
  GraduationCap,
  HandCoins,
  House,
  Landmark,
  Plane,
  PiggyBank,
  Vault,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import type { AccountAvatarProps, AccountIconKey } from '@grana/ui-contracts'
import { accountColors } from '../../lib/colors'

const ICONS: Record<AccountIconKey, LucideIcon> = {
  wallet: Wallet,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  coins: Coins,
  vault: Vault,
  briefcase: Briefcase,
  'dollar-sign': DollarSign,
  landmark: Landmark,
  'credit-card': CreditCard,
  'building-2': Building2,
  house: House,
  car: Car,
  plane: Plane,
  'graduation-cap': GraduationCap,
  gift: Gift,
  'hand-coins': HandCoins,
}

const SIZES = {
  sm: { box: 32, radius: 8, icon: 16, font: 12 },
  md: { box: 44, radius: 10, icon: 20, font: 14 },
} as const

/**
 * Account visual identity (mobile). Props are already resolved by
 * `resolveAccountAvatar`. Color comes from a palette key (mapped to the mirrored
 * `--account-*` token value) or a raw `colorOverride` (institution brand color).
 * When `iconKey` is null, the monogram is shown. The glyph is always white.
 */
export function AccountAvatar({
  colorKey,
  colorOverride,
  iconKey,
  monogram,
  size = 'md',
}: AccountAvatarProps) {
  const dims = SIZES[size]
  const background = colorKey ? accountColors[colorKey] : (colorOverride ?? accountColors.slate)
  const Icon = iconKey ? ICONS[iconKey] : null

  return (
    <View
      style={{
        width: dims.box,
        height: dims.box,
        borderRadius: dims.radius,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Icon ? (
        <Icon size={dims.icon} color="#FFFFFF" strokeWidth={2} />
      ) : (
        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: dims.font }}>{monogram}</Text>
      )}
    </View>
  )
}
