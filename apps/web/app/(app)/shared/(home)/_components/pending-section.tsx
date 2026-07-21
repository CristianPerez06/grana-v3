import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getPendingSettlements } from '@grana/shared'
import { getAccounts } from '@/lib/accounts/queries'
import { PendingSettlementCard } from '../../_components/pending-settlement-card'

// Settlements the current user must assign to a receiving account. Today-
// anchored; own boundary so it streams independently of the month sections.
export const PendingSection = async () => {
  const supabase = await createClient()
  const t = await getTranslations('shared')
  const [pending, accounts] = await Promise.all([
    getPendingSettlements(supabase),
    getAccounts(supabase),
  ])
  if (pending.length === 0) return null

  const settleAccounts = [...accounts.cash, ...accounts.bank].map((a) => ({
    id: a.id,
    name: a.name,
    institutionName: a.institution?.name ?? null,
    balances: a.balances,
  }))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
        {t('settle.pending_title')}
      </h2>
      {pending.map((p) => (
        <PendingSettlementCard key={p.id} settlement={p} accounts={settleAccounts} />
      ))}
    </section>
  )
}
