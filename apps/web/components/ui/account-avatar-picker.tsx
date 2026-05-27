'use client'

import { useTranslations } from 'next-intl'
import {
  ACCOUNT_COLOR_KEYS,
  ACCOUNT_ICON_KEYS,
  type AccountColorKey,
  type AccountIconKey,
} from '@grana/ui-contracts'
import { AccountAvatar } from './account-avatar'
import { cn } from '@/lib/utils'

type Props = {
  colorKey: AccountColorKey | null
  iconKey: AccountIconKey | null
  onColorChange: (key: AccountColorKey | null) => void
  onIconChange: (key: AccountIconKey | null) => void
  /** Bank's inherited brand color, used for the "auto" color preview. */
  inheritedColor?: string | null
  /** Icon shown when none is picked (cash → wallet, bank → landmark/wallet). */
  autoIcon: AccountIconKey
  /** Monogram fallback for the preview. */
  monogram: string
}

const AUTO_PLACEHOLDER = 'var(--text-soft)'

/**
 * Controlled color + icon picker for an account avatar. `null` on either field
 * means "auto" (the avatar is derived server-side). The preview reflects the
 * current selection, falling back to the inherited/auto appearance.
 */
export const AccountAvatarPicker = ({
  colorKey,
  iconKey,
  onColorChange,
  onIconChange,
  inheritedColor,
  autoIcon,
  monogram,
}: Props) => {
  const t = useTranslations('accounts')

  const previewColorKey = colorKey
  const previewColorOverride = colorKey ? null : (inheritedColor ?? AUTO_PLACEHOLDER)
  const previewIconKey = iconKey ?? autoIcon

  const swatchBase =
    'h-8 w-8 rounded-md ring-offset-2 ring-offset-background transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-foreground">{t('labels.appearance')}</span>

      <div className="flex items-center gap-3">
        <AccountAvatar
          colorKey={previewColorKey}
          colorOverride={previewColorOverride}
          iconKey={previewIconKey}
          monogram={monogram}
          size="md"
        />
        <p className="text-xs text-muted-foreground">{t('labels.avatar_auto')}</p>
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{t('labels.color')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onColorChange(null)}
            aria-pressed={colorKey === null}
            className={cn(
              swatchBase,
              'flex items-center justify-center border border-dashed border-input text-[10px] text-muted-foreground',
              colorKey === null && 'ring-2 ring-ring',
            )}
          >
            {t('labels.avatar_auto')[0]}
          </button>
          {ACCOUNT_COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              aria-pressed={colorKey === c}
              aria-label={c}
              className={cn(swatchBase, colorKey === c && 'ring-2 ring-ring')}
              style={{ backgroundColor: `var(--account-${c})` }}
            />
          ))}
        </div>
      </div>

      {/* Icons */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{t('labels.icon')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onIconChange(null)}
            aria-pressed={iconKey === null}
            className={cn(
              'h-8 w-8 rounded-md border border-dashed border-input text-[10px] text-muted-foreground transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              iconKey === null && 'ring-2 ring-ring',
            )}
          >
            {t('labels.avatar_auto')[0]}
          </button>
          {ACCOUNT_ICON_KEYS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIconChange(i)}
              aria-pressed={iconKey === i}
              aria-label={i}
              className={cn(
                'rounded-md ring-offset-2 ring-offset-background transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                iconKey === i && 'ring-2 ring-ring',
              )}
            >
              <AccountAvatar colorKey="slate" colorOverride={null} iconKey={i} monogram="?" size="sm" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
