'use client'

import { useTranslations } from 'next-intl'

type Props = {
  currentEndDate: string
  currentDueDate: string
  nextEndDate: string
  nextDueDate: string
  onChange: (field: 'currentEndDate' | 'currentDueDate' | 'nextEndDate' | 'nextDueDate', value: string) => void
  errors?: Partial<Record<'currentEndDate' | 'currentDueDate' | 'nextEndDate' | 'nextDueDate', string>>
}

export const CardCycleSection = ({
  currentEndDate,
  currentDueDate,
  nextEndDate,
  nextDueDate,
  onChange,
  errors = {},
}: Props) => {
  const t = useTranslations('cards')
  return (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {t('labels.current_period')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('labels.close_date')}</label>
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => onChange('currentEndDate', e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.currentEndDate && (
            <p className="text-xs text-destructive">{errors.currentEndDate}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('labels.due_date')}</label>
          <input
            type="date"
            value={currentDueDate}
            onChange={(e) => onChange('currentDueDate', e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.currentDueDate && (
            <p className="text-xs text-destructive">{errors.currentDueDate}</p>
          )}
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {t('labels.next_period')}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('labels.close_date')}</label>
          <input
            type="date"
            value={nextEndDate}
            onChange={(e) => onChange('nextEndDate', e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.nextEndDate && (
            <p className="text-xs text-destructive">{errors.nextEndDate}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('labels.due_date')}</label>
          <input
            type="date"
            value={nextDueDate}
            onChange={(e) => onChange('nextDueDate', e.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.nextDueDate && (
            <p className="text-xs text-destructive">{errors.nextDueDate}</p>
          )}
        </div>
      </div>
    </div>
  </div>
  )
}
