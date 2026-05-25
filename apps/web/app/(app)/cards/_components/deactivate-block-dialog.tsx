'use client'

import { useTranslations } from 'next-intl'

type Props = {
  open: boolean
  onClose: () => void
}

export const DeactivateBlockDialog = ({ open, onClose }: Props) => {
  const t = useTranslations('cards')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-xl flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t('deactivate_block.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('deactivate_block.description')}
        </p>
        <button
          onClick={onClose}
          className="self-end inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('actions.got_it')}
        </button>
      </div>
    </div>
  )
}
