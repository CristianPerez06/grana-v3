import { getTranslations } from 'next-intl/server'
import { getCashAndBankAccounts } from '@/lib/accounts/queries'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { SectionFallback } from '@/components/ui/section-fallback'
import { AccountSection } from './account-section'
import { AccountsHint } from './accounts-hint'
import { EmptyAccountsState } from './empty-accounts-state'

export const ActiveAccountsContainer = async () => {
  let cash: AccountWithBalances[]
  let bank: AccountWithBalances[]
  try {
    ;({ cash, bank } = await getCashAndBankAccounts())
  } catch {
    const t = await getTranslations('accounts.route')
    return <SectionFallback message={t('active_error')} className="min-h-[14rem]" />
  }

  const t = await getTranslations('accounts')
  const total = cash.length + bank.length

  if (total === 0) return <EmptyAccountsState />

  return (
    <div className="flex flex-col gap-8">
      {total === 1 && <AccountsHint />}
      <AccountSection title={t('sections.cash')} accounts={cash} />
      <AccountSection title={t('sections.bank')} accounts={bank} />
    </div>
  )
}
