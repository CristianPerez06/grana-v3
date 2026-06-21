'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// Curated set of category-relevant emojis. Free-text entry is no longer needed:
// the user picks from this grid. The stored value is still a plain emoji string,
// so existing categories with any emoji keep rendering fine.
const ICONS = [
  '🍔', '🛒', '☕', '🍺', '🍷', '🚗', '⛽', '🚌', '✈️', '🏠',
  '💡', '🚿', '📱', '💻', '👕', '💄', '💊', '🏥', '🏋️', '🎓',
  '📚', '🎬', '🎵', '🎮', '⚽', '🐾', '🎁', '💰', '💳', '🏦',
  '📈', '🧾', '🌱', '🔧', '🧹', '🚸',
]

type Props = {
  value: string
  onChange: (value: string) => void
}

export const IconPicker = ({ value, onChange }: Props) => {
  const t = useTranslations('settings.categories.form')
  const [open, setOpen] = useState(false)

  const select = (icon: string) => {
    onChange(icon)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{t('icon_label')}</label>
      <Popover
        modal
        open={open}
        onOpenChange={setOpen}
        align="start"
        trigger={
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {value ? (
              <span className="text-xl leading-none">{value}</span>
            ) : (
              <span className="text-muted-foreground">{t('icon_pick')}</span>
            )}
          </button>
        }
      >
        <div className="grid grid-cols-6 gap-1 p-1">
          {ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => select(icon)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-muted',
                value === icon && 'bg-muted ring-2 ring-ring',
              )}
            >
              {icon}
            </button>
          ))}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => select('')}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            {t('icon_none')}
          </button>
        )}
      </Popover>
    </div>
  )
}
