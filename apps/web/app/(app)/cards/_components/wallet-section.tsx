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
      <div className="flex flex-col items-start gap-1 px-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-text-soft">
          {t('wallet.section_title')}
        </h2>
        {hasCards && (
          <span className="text-xs text-text-muted">{t('wallet.section_hint')}</span>
        )}
      </div>
      {children}
    </section>
  )
}
