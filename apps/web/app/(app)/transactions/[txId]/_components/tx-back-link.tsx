'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

/**
 * Back-link del chrome de /transactions/[txId]. Cliente porque depende del
 * search param `from` (no disponible en layouts server). Computa backHref
 * desde `from` igual que `page.tsx`; el label es estático.
 */
export const TxBackLink = () => {
  const sp = useSearchParams()
  const from = sp.get('from')
  const t = useTranslations('transactions')

  const fromAccountId = from?.startsWith('account:') ? from.slice('account:'.length) : null
  const fromCardId = from?.startsWith('card:') ? from.slice('card:'.length) : null
  const backHref = fromAccountId
    ? `/accounts/${fromAccountId}`
    : fromCardId
      ? `/cards/${fromCardId}`
      : '/transactions'

  return (
    <div className="flex items-center px-3.5 pt-3.5 pb-1.5">
      <Link
        href={backHref}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${t('back_label')}`}
      </Link>
    </div>
  )
}
