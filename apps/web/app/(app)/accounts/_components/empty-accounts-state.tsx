import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export const EmptyAccountsState = async () => {
  const t = await getTranslations('accounts')
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-soft bg-card px-6 py-16 text-center">
      <p className="text-lg font-semibold text-text">{t('empty.title')}</p>
      <p className="mt-2 max-w-sm text-sm text-text-soft">
        {t('empty.description')}
      </p>
      <Link
        href="/accounts/new"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {`+ ${t('actions.create')}`}
      </Link>
    </div>
  )
}
