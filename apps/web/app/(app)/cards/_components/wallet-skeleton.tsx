import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'

const GROUPS = 2
const ROWS_PER_GROUP = 2

const CompactRowSkeleton = () => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
    <span className="h-9 w-9 shrink-0 rounded-[10px] bg-muted animate-pulse" />
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="h-4 w-40 rounded bg-muted animate-pulse" />
      <span className="h-3 w-52 rounded bg-muted/70 animate-pulse" />
    </div>
    <div className="flex items-center gap-3">
      <span className="h-4 w-20 rounded bg-muted animate-pulse" />
      <span className="h-6 w-16 rounded-full bg-muted/70 animate-pulse" />
    </div>
  </div>
)

const BankGroupSkeleton = () => (
  <Card className="overflow-hidden">
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="h-4 w-4 shrink-0 rounded bg-muted/70 animate-pulse" />
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted animate-pulse" />
      <span className="h-4 w-28 rounded bg-muted animate-pulse" />
      <span className="flex-1" />
      <span className="h-5 w-20 rounded-full bg-muted/70 animate-pulse" />
    </div>
    <div className="flex flex-col border-t border-border">
      {Array.from({ length: ROWS_PER_GROUP }).map((_, i) => (
        <div key={i} className="border-t border-border-soft first:border-t-0">
          <CompactRowSkeleton />
        </div>
      ))}
    </div>
  </Card>
)

export const WalletSkeleton = async () => {
  const t = await getTranslations('cards.route')
  return (
    <section
      className="flex flex-col gap-4 min-h-[18rem]"
      aria-busy="true"
      aria-label={t('wallet_loading')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="h-5 w-32 rounded bg-muted animate-pulse" />
        <span className="h-3 w-40 rounded bg-muted/70 animate-pulse" />
      </div>
      {/* Filter row */}
      <span className="h-9 w-full rounded-[var(--radius-lg)] bg-muted/50 animate-pulse" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: GROUPS }).map((_, i) => (
          <BankGroupSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}
