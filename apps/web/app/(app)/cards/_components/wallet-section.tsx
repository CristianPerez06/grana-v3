import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  hasCards: boolean
  children: ReactNode
}

export const WalletSection = ({ hasCards, children }: Props) => {
  const t = useTranslations('cards')
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t('wallet.section_title')}</h2>
        {hasCards && (
          <span className="text-xs text-text-muted">
            {t('wallet.section_hint')}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
