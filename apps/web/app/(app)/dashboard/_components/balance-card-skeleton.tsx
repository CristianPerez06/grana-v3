import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'

const PLACEMENT_ROWS = 2

// Shape-matched skeleton for the balance card: the dark zone with the total,
// the USD line and the two "Dónde está" columns. One skeleton for the whole
// card — its zones come from different reads, but they share a card, so filling
// them in separately would make it assemble in jumps in front of the user.
export const BalanceCardSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card className="overflow-hidden p-0" aria-busy="true" aria-label={t('hero_loading')}>
      <div className="bg-surface-dark px-[22px] pb-5 pt-6">
        <div className="mx-auto h-3 w-40 animate-pulse rounded bg-white/15" />
        <div className="mx-auto mt-[11px] h-10 w-64 max-w-full animate-pulse rounded bg-white/20" />
        <div className="mt-[13px] flex items-center justify-center gap-2.5">
          <div className="h-5 w-11 animate-pulse rounded-full bg-white/15" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
        </div>

        <div className="relative mt-[18px]">
          <div className="mx-auto grid max-w-[660px] grid-cols-2 gap-4 border-t border-white/10 pt-[15px]">
            <div className="h-3.5 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-3.5 w-10 animate-pulse rounded bg-white/10" />
          </div>
          <div className="absolute bottom-0 right-0 h-3.5 w-24 animate-pulse rounded bg-white/10" />
        </div>

        <div className="mx-auto mt-3 grid max-w-[660px] grid-cols-2 gap-4">
          {[0, 1].map((column) => (
            <div key={column} className={column === 1 ? 'border-l border-white/10 pl-[15px]' : ''}>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                {Array.from({ length: PLACEMENT_ROWS }).map((_, row) => (
                  <div
                    key={row}
                    className={`flex items-center gap-2 ${row === 1 ? 'justify-end' : ''}`}
                  >
                    <span className="size-[10px] shrink-0 animate-pulse rounded-[2px] bg-white/15" />
                    <span className="h-3.5 w-14 animate-pulse rounded bg-white/15" />
                    <span className="h-3.5 w-9 shrink-0 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen del mes */}
      <div className="border-t border-border px-[26px] pb-5 pt-5">
        <div className="h-[18px] w-40 animate-pulse rounded bg-muted" />
        <div className="mx-auto mt-[15px] grid max-w-[660px] grid-cols-3 gap-[18px]">
          {[0, 1, 2].map((column) => (
            <div key={column} className="flex flex-col items-center gap-2.5">
              <div className="h-4 w-16 animate-pulse rounded bg-muted/70" />
              <div className="h-6 w-28 max-w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
