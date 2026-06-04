import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'

const WALLET_CARDS = 2

const WalletCardSkeleton = () => (
  <Card className="relative overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 w-1 bg-muted/60 animate-pulse"
      aria-hidden
    />
    <div className="flex flex-col gap-4 py-5 pl-7 pr-6">
      <div className="flex items-start gap-3">
        <span className="h-11 w-11 shrink-0 rounded-xl bg-muted animate-pulse" />
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <span className="h-4 w-40 rounded bg-muted animate-pulse" />
          <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
        </div>
        <span className="h-5 w-16 shrink-0 rounded-full bg-muted/70 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="h-2.5 w-16 rounded bg-muted/70 animate-pulse" />
            <span className="h-5 w-20 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border pt-3">
        <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
        <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
      </div>
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {Array.from({ length: WALLET_CARDS }).map((_, i) => (
          <WalletCardSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}
