import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/accounts/queries'
import { PageHeader } from '@/components/ui/page-header'
import { AccountSection } from './_components/account-section'
import { EmptyAccountsState } from './_components/empty-accounts-state'
import { AccountsHint } from './_components/accounts-hint'

const AccountsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('accounts')
  const grouped = await getAccounts({ includeArchived: true })

  const activeCash = grouped.cash.filter((a) => a.is_active)
  const activeBank = grouped.bank.filter((a) => a.is_active)
  const archived = [...grouped.cash, ...grouped.bank].filter((a) => !a.is_active)

  const activeTotal = activeCash.length + activeBank.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        actions={
          <Link
            href="/accounts/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {`+ ${t('actions.create')}`}
          </Link>
        }
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
