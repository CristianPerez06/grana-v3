import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export const EmptyAccountsState = async () => {
  const t = await getTranslations('accounts')
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-soft bg-card px-6 py-16 text-center">
      <p className="text-lg font-semibold text-text">{t('empty.title')}</p>
      <p className="mt-2 max-w-sm text-sm text-text-soft">
        {t('empty.description')}
      </p>
      <Button asChild variant="primary" className="mt-6 w-auto">
        <Link href="/accounts/new">
          <Plus className="size-4" aria-hidden />
          {t('actions.create')}
        </Link>
      </Button>
    </div>
  )
}
