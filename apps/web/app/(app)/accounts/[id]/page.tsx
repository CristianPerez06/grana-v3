import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAccountDetail } from '@/lib/accounts/queries'
import { AccountDetailHeader } from './_components/account-detail-header'

type Props = {
  params: Promise<{ id: string }>
}

const AccountDetailPage = async ({ params }: Props) => {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const account = await getAccountDetail(id)
  if (!account) notFound()

  const inactiveCurrencies = account.currencies.filter((c) => !c.is_active)
  const allCurrencyCodes = new Set(account.currencies.map((c) => c.currency_code))
  const canAddCurrency =
    !allCurrencyCodes.has('ARS') ||
    !allCurrencyCodes.has('USD') ||
    inactiveCurrencies.length > 0

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Cuentas
        </Link>
      </div>

      <AccountDetailHeader account={account} />

      {canAddCurrency && (
        <Link
          href={`/accounts/${account.id}/edit`}
          className="self-start text-sm text-primary hover:underline"
        >
          + Agregar moneda
        </Link>
      )}

      {/* Movements placeholder */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Movimientos
        </h2>
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Todavía no hay movimientos en esta cuenta.
          </p>
        </div>
      </section>
    </div>
  )
}

export default AccountDetailPage
