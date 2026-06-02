import { getTranslations } from 'next-intl/server'
import { getCashAndBankAccounts } from '@/lib/accounts/queries'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { SectionFallback } from '@/components/ui/section-fallback'
import { AccountSection } from './account-section'

export const ArchivedAccountsContainer = async () => {
  let archived: AccountWithBalances[]
  try {
    const { cash, bank } = await getCashAndBankAccounts({ archivedOnly: true })
    archived = [...cash, ...bank]
  } catch {
    const t = await getTranslations('accounts.route')
    return <SectionFallback message={t('archived_error')} className="min-h-[3rem]" />
  }

  if (archived.length === 0) return null

  const t = await getTranslations('accounts')
  return <AccountSection title={t('sections.archived')} accounts={archived} archived />
}
