import { getTranslations } from 'next-intl/server'
import { getCashAndBankAccounts, getInstitutions } from '@/lib/accounts/queries'
import type { AccountWithBalances, Institution } from '@/lib/accounts/types'
import { SectionFallback } from '@/components/ui/section-fallback'
import { AccountSection } from './account-section'
import { AccountsHint } from './accounts-hint'
import { AccountsEditDrawerProvider } from './accounts-edit-drawer'
import { EmptyAccountsState } from './empty-accounts-state'

export const ActiveAccountsContainer = async () => {
  let cash: AccountWithBalances[]
  let bank: AccountWithBalances[]
  let institutions: Institution[]
  try {
    ;[{ cash, bank }, institutions] = await Promise.all([
      getCashAndBankAccounts(),
      getInstitutions(),
    ])
  } catch {
    const t = await getTranslations('accounts.route')
    return <SectionFallback message={t('active_error')} className="min-h-[14rem]" />
  }

  const t = await getTranslations('accounts')
  const total = cash.length + bank.length

  if (total === 0) return <EmptyAccountsState />

  return (
    <AccountsEditDrawerProvider institutions={institutions}>
      <div className="flex flex-col gap-8">
        {total === 1 && <AccountsHint />}
        <AccountSection title={t('sections.cash')} accounts={cash} />
        <AccountSection title={t('sections.bank')} accounts={bank} />
      </div>
    </AccountsEditDrawerProvider>
  )
}
