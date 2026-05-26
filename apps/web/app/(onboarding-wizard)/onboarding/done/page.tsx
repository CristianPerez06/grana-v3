import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { completeOnboardingAction } from '@/app/_actions/onboarding'

const DonePage = async () => {
  const t = await getTranslations('onboarding.done')

  // Mark onboarding as completed (idempotent — safe to revisit).
  await completeOnboardingAction()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aggregate initial_balance per currency across the user's active
  // cash + bank accounts. This is the "starting available" the user just
  // declared in /initial-balance.
  const { data: rows } = await supabase
    .from('account_currencies')
    .select('currency_code, initial_balance, accounts!inner(user_id, type, is_active)')
    .eq('accounts.user_id', user.id)
    .eq('accounts.is_active', true)
    .in('accounts.type', ['cash', 'bank'])

  const totals: Record<string, number> = { ARS: 0, USD: 0 }
  for (const row of rows ?? []) {
    const amount = Number(row.initial_balance ?? 0)
    totals[row.currency_code] = (totals[row.currency_code] ?? 0) + amount
  }

  const hasData = totals.ARS > 0 || totals.USD > 0

  return (
    <div className="flex flex-col gap-8 text-center">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      </header>

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-text-muted">
          {t('balance_label')}
        </p>
        <p className="text-3xl font-semibold tabular-nums">
          {formatARS(totals.ARS ?? 0)}
        </p>
        {totals.USD > 0 && (
          <p className="text-sm text-text-muted tabular-nums">
            {formatUSD(totals.USD ?? 0)}
          </p>
        )}
      </div>

      <p className="text-sm text-text-muted">
        {hasData ? t('next_step_with_data') : t('next_step_skip')}
      </p>

      <Button asChild>
        <Link href="/dashboard">{t('cta')}</Link>
      </Button>
    </div>
  )
}

const formatARS = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatUSD = (n: number) =>
  `US$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default DonePage
