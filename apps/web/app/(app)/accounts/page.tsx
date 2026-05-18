import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/accounts/queries'
import { AccountSection } from './_components/account-section'
import { EmptyAccountsState } from './_components/empty-accounts-state'

const AccountsPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const grouped = await getAccounts({ includeArchived: true })

  const activeCash = grouped.cash.filter((a) => a.is_active)
  const activeBank = grouped.bank.filter((a) => a.is_active)
  const archived = [...grouped.cash, ...grouped.bank].filter((a) => !a.is_active)

  const activeTotal = activeCash.length + activeBank.length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
        <Link
          href="/accounts/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Crear cuenta
        </Link>
      </div>

      {activeTotal === 0 && archived.length === 0 ? (
        <EmptyAccountsState />
      ) : (
        <div className="flex flex-col gap-8">
          <AccountSection title="Efectivo" accounts={activeCash} />
          <AccountSection title="Cuentas bancarias" accounts={activeBank} />
          {archived.length > 0 && (
            <AccountSection title="Archivadas" accounts={archived} archived />
          )}
        </div>
      )}
    </div>
  )
}

export default AccountsPage
