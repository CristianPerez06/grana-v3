import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MaskedAmount } from './masked-amount'

export type SharedNet = {
  currency: 'ARS' | 'USD'
  amount: number
  direction: 'they_owe_you' | 'you_owe'
}

type Props = {
  householdName: string
  otherName: string
  selfInitials: string
  otherInitials: string
  /** Non-settled currencies; the first (ARS-first) is the primary line. */
  nets: SharedNet[]
}

const Avatar = ({ initials, className }: { initials: string; className?: string }) => (
  <span
    aria-hidden
    className={cn(
      'flex size-[22px] items-center justify-center rounded-full border-2 border-card bg-emerald text-[10px] font-bold text-white',
      className,
    )}
  >
    {initials}
  </span>
)

// "Compartido" — a thin full-width strip that surfaces the net of the user's
// household on the dashboard. Single household today, so the net is one
// direction (te deben / debés), per currency. Read-only: the whole strip links
// to /shared. Rendered only when the container resolves a non-settled net.
export const SharedStrip = async ({
  householdName,
  otherName,
  selfInitials,
  otherInitials,
  nets,
}: Props) => {
  const t = await getTranslations('dashboard.shared_strip')
  const [primary, ...rest] = nets
  const creditTone = primary.direction === 'they_owe_you'
  // Static keys (no dynamic t(variable)) to keep next-intl typing happy.
  const dirLabel = (direction: SharedNet['direction']) =>
    direction === 'they_owe_you' ? t('they_owe_you') : t('you_owe')

  return (
    <Card asChild>
      <Link
        href="/shared"
        className="flex items-center gap-3 p-4 transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-4"
      >
        <span
          aria-hidden
          className="flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-emerald-soft text-emerald-deep"
        >
          <Users size={18} strokeWidth={2.25} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-text">{t('title')}</span>
            <span className="flex -space-x-1.5">
              <Avatar initials={selfInitials} />
              <Avatar initials={otherInitials} />
            </span>
          </div>
          <p className="truncate text-[12px] font-medium text-text-soft">
            {t('caption', { household: householdName, other: otherName })}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={cn(
              'text-[15px] font-extrabold tracking-tight sm:text-[17px]',
              creditTone ? 'text-emerald-deep' : 'text-expense',
            )}
          >
            {dirLabel(primary.direction)}{' '}
            <MaskedAmount
              amount={primary.amount}
              currency={primary.currency}
              showCentsOverride={primary.currency === 'USD'}
            />
          </p>
          <p className="text-[11.5px] font-medium text-text-soft">
            {creditTone ? t('sub_credit') : t('sub_debit')}
            {rest.map((n) => (
              <span key={n.currency}>
                {' · '}
                {dirLabel(n.direction)}{' '}
                <MaskedAmount amount={n.amount} currency={n.currency} showCentsOverride />
              </span>
            ))}
          </p>
        </div>

        <ChevronRight size={18} className="shrink-0 text-text-soft" aria-hidden />
      </Link>
    </Card>
  )
}
