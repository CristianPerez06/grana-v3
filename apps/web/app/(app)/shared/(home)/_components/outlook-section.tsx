import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { BalanceCurrency } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getHouseholdDebt, getHouseholdOutlook } from '@grana/shared'
import { Card } from '@/components/ui/card'
import { fmtMoney } from '../../_components/money'
import { monthShort } from './format'

// Sparkline of the projected balance (today → upcoming months).
const sparkline = (values: number[]) => {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 300
  const H = 72
  const P = 8
  const pts = values.map((v, i) => {
    const x = P + (i / (values.length - 1)) * (W - 2 * P)
    const y = H - P - ((v - min) / range) * (H - 2 * P)
    return [x, y] as const
  })
  const [fx, fy] = pts[0]
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[72px] w-full" aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="#11B981"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={fx} cy={fy} r={4.5} fill={values[0] < 0 ? '#C2705C' : '#11B981'} />
      <circle cx={lx} cy={ly} r={5} fill="#11B981" />
    </svg>
  )
}

// "Lo que se viene" — forward projection tile. Today-anchored (derived with
// asOf per month, always from today), so it does NOT follow the header's month
// navigator and stays a server component. Own boundary, independent of the
// month-scoped sections.
export const OutlookSection = async () => {
  const supabase = await createClient()
  const t = await getTranslations('shared')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userId = user.id

  const [outlook, debt] = await Promise.all([
    getHouseholdOutlook(supabase),
    getHouseholdDebt(supabase),
  ])

  const balanceForYou = (cur: BalanceCurrency): number => {
    const d = debt?.[cur]
    if (!d || d.kind === 'settled') return 0
    return d.to === userId ? d.amount : -d.amount
  }
  const arsForYou = balanceForYou('ARS')

  const projMonths = outlook ? outlook.ARS.filter((m) => m.items.length > 0) : []
  const projValues = [arsForYou, ...(outlook?.ARS.map((m) => m.cumulativeForA) ?? [])]
  const projectedEnd =
    outlook && outlook.ARS.length ? outlook.ARS[outlook.ARS.length - 1].cumulativeForA : arsForYou
  const nextImpact = projMonths[0]?.items[0]
  const nextImpactMonth = projMonths[0] ? monthShort(projMonths[0].month) : ''

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-text-soft">
          {t('dashboard.upcoming_home')}
        </span>
        <span className="rounded-full bg-slate-soft px-2.5 py-0.5 text-[10px] font-bold text-slate">
          {t('dashboard.projection')}
        </span>
      </div>
      {projMonths.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6 text-center">
          <span className="text-3xl" aria-hidden>
            🌴
          </span>
          <p className="text-sm font-extrabold text-text">{t('dashboard.upcoming_none_title')}</p>
          <p className="text-xs text-text-muted">{t('dashboard.upcoming_none_hint')}</p>
        </div>
      ) : (
        <>
          {nextImpact && (
            <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-800">
              <span className="size-2 rounded-full bg-amber-500" />
              {t('dashboard.next_impact')}: {nextImpact.label}
              {nextImpactMonth ? ` · ${nextImpactMonth}` : ''}
            </div>
          )}
          {projValues.some((v, i) => i > 0 && v !== projValues[0]) && (
            <>
              {sparkline(projValues)}
              <div className="mt-1 flex justify-between px-1 text-[11px] font-bold">
                <span className="text-[#C2705C]">{t('dashboard.today_short')}</span>
                {(outlook?.ARS ?? []).map((mo, i, arr) => (
                  <span key={mo.month} className={i === arr.length - 1 ? 'text-income' : 'text-text-muted'}>
                    {monthShort(mo.month)}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-3 flex items-baseline justify-center gap-2 border-t border-border-soft pt-3">
            <span className={`text-2xl font-black tabular-nums ${projectedEnd >= 0 ? 'text-income' : 'text-expense'}`}>
              {projectedEnd >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(projectedEnd), 'ARS')}
            </span>
            <span className="text-xs text-text-muted">{t('dashboard.projected_balance')}</span>
          </div>
        </>
      )}
    </Card>
  )
}
