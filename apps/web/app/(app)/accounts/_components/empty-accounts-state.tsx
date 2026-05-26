import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

type Props = {
  /** Whether to show the "create account" CTA. Hidden in novato mode. */
  showCreate?: boolean
}

export const EmptyAccountsState = async ({ showCreate = true }: Props) => {
  const t = await getTranslations('accounts')
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-medium text-foreground">{t('empty.title')}</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        {t('empty.description')}
      </p>
      {showCreate && (
        <Link
          href="/accounts/new"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {`+ ${t('actions.create')}`}
        </Link>
      )}
    </div>
  )
}
