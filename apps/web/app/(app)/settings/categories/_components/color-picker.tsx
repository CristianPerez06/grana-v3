'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// Preset palette. Every value matches the `#RRGGBB` shape required by
// `createCategorySchema`/`updateCategorySchema`. A native color input covers
// custom colors without leaving the form.
const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#EC4899', '#F43F5E', '#64748B',
]

type Props = {
  value: string
  onChange: (value: string) => void
}

export const ColorPicker = ({ value, onChange }: Props) => {
  const t = useTranslations('settings.categories.form')
  const isCustom = Boolean(value) && !COLORS.includes(value.toUpperCase())

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{t('color_label')}</label>
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              'h-7 w-7 rounded-full border border-black/10 transition-transform hover:scale-110',
              value.toUpperCase() === color && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
            )}
          />
        ))}

        {/* Custom color via native picker */}
        <label
          className={cn(
            'relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-input text-xs text-muted-foreground transition-colors hover:bg-muted',
            isCustom && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
          )}
          title={t('color_custom')}
          style={isCustom ? { backgroundColor: value, borderStyle: 'solid' } : undefined}
        >
          {!isCustom && '+'}
          <input
            type="color"
            value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#3B82F6'}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="ml-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('color_none')}
          </button>
        )}
      </div>
    </div>
  )
}
