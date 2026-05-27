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
} from 'lucide-react'
import type { AccountAvatarProps, AccountIconKey } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

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
  sm: { box: 'h-8 w-8 rounded-md text-xs', icon: 16 },
  md: { box: 'h-11 w-11 rounded-lg text-sm', icon: 20 },
} as const

/**
 * Account visual identity. Props are already resolved by `resolveAccountAvatar`
 * (server-side). Color comes from either a palette key (rendered through the
 * `--account-<key>` token) or a raw `colorOverride` (an institution brand
 * color). When `iconKey` is null, the monogram is shown instead. The glyph is
 * always light, so every palette/override color must keep enough contrast.
 */
export const AccountAvatar = ({
  colorKey,
  colorOverride,
  iconKey,
  monogram,
  size = 'md',
  className,
}: AccountAvatarProps) => {
  const dims = SIZES[size]
  const background = colorKey ? `var(--account-${colorKey})` : (colorOverride ?? 'var(--account-slate)')
  const Icon = iconKey ? ICONS[iconKey] : null

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold text-white',
        dims.box,
        className,
      )}
      style={{ backgroundColor: background }}
      aria-hidden
    >
      {Icon ? <Icon size={dims.icon} strokeWidth={2} aria-hidden /> : monogram}
    </span>
  )
}
