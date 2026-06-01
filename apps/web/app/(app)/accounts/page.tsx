import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAccounts, getInstitutions } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
import { AccountSection } from './_components/account-section'
import { EmptyAccountsState } from './_components/empty-accounts-state'
import { AccountsHint } from './_components/accounts-hint'
import { CreateAccountButton } from './_components/create-account-button'

const AccountsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('accounts')
  const [grouped, institutions] = await Promise.all([
    getAccounts({ includeArchived: true }),
    getInstitutions(),
  ])

  const activeCash = grouped.cash.filter((a) => a.is_active)
  const activeBank = grouped.bank.filter((a) => a.is_active)
  const archived = [...grouped.cash, ...grouped.bank].filter((a) => !a.is_active)

  const activeTotal = activeCash.length + activeBank.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={<CreateAccountButton institutions={institutions} />}
      />

      {activeTotal === 0 && archived.length === 0 ? (
        <EmptyAccountsState />
      ) : (
        <div className="flex flex-col gap-8">
          {activeTotal === 1 && <AccountsHint />}
          <AccountSection title={t('sections.cash')} accounts={activeCash} />
          <AccountSection title={t('sections.bank')} accounts={activeBank} />
          {archived.length > 0 && (
            <AccountSection title={t('sections.archived')} accounts={archived} archived />
          )}
        </div>
      )}
    </div>
  )
}

export default AccountsPage
