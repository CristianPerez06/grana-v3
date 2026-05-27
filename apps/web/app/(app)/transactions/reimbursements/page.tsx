import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { getShowCents } from '@/lib/preferences'
import { PageHeader } from '@/components/ui/page-header'
import { getAllReimbursements, type ReimbursementState } from '@/lib/transactions/queries'

type Props = {
  searchParams: Promise<{ state?: string }>
}

const FILTERS: Array<ReimbursementState | 'all'> = ['all', 'pending', 'received', 'cancelled']

const stateBadgeClass = (state: ReimbursementState) =>
  state === 'received'
    ? 'bg-green-100 text-green-800'
    : state === 'cancelled'
      ? 'bg-muted text-muted-foreground line-through'
      : 'bg-amber-100 text-amber-800'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const ReimbursementsListPage = async ({ searchParams }: Props) => {
  const { state: stateParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeState: ReimbursementState | 'all' =
    stateParam === 'pending' || stateParam === 'received' || stateParam === 'cancelled'
      ? stateParam
      : 'all'

  const [items, showCents, t] = await Promise.all([
    getAllReimbursements(activeState === 'all' ? undefined : activeState),
    getShowCents(),
    getTranslations('transactions'),
  ])

  const format = (amount: number, currency: 'ARS' | 'USD') =>
    currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('reimbursement.list.title')}
        description={t('reimbursement.list.description')}
        backLink={{ href: '/transactions', label: t('title') }}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const href = f === 'all' ? '/transactions/reimbursements' : `/transactions/reimbursements?state=${f}`
          const active = activeState === f
          return (
            <Link
              key={f}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {t(`reimbursement.list.filter.${f}`)}
            </Link>
          )
        })}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('reimbursement.list.empty')}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {items.map((r) => {
            const primary = r.expenseDescription ?? r.categoryName ?? t('reimbursement.label')
            return (
              <Link
                key={r.id}
                href={`/transactions/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {r.categoryIcon && (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base"
                      style={{ backgroundColor: `${r.categoryColor ?? '#888'}1A` }}
                    >
                      {r.categoryIcon}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{primary}</span>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${stateBadgeClass(r.state)}`}
                      >
                        {t(`reimbursement.state.${r.state}`)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`reimbursement.target.${r.target}`)}
                      {r.accountName ? ` · ${r.accountName}` : ''} · {formatDate(r.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    r.state === 'cancelled' ? 'text-muted-foreground line-through' : 'text-green-600'
                  }`}
                >
                  +{format(r.amount, r.currencyCode)}
                  {r.currencyCode === 'USD' && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">USD</span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReimbursementsListPage
