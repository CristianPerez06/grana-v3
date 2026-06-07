import { getTranslations } from 'next-intl/server'

const SectionSkeleton = ({ rowCount }: { rowCount: number }) => (
  <section className="flex flex-col gap-3">
    <div className="flex items-baseline gap-2 px-1">
      <span className="h-3 w-20 rounded bg-muted animate-pulse" />
      <span className="h-3 w-6 rounded bg-muted/70 animate-pulse" />
    </div>
    <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-card">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex min-h-[78px] items-center gap-4 px-5 py-4">
          <span className="size-10 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
            <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="h-3.5 w-20 rounded bg-muted animate-pulse" />
            <span className="h-3 w-16 rounded bg-muted/70 animate-pulse" />
          </div>
          <span className="size-9 shrink-0 rounded-lg bg-muted/70 animate-pulse" />
        </div>
      ))}
    </div>
  </section>
)

export const ActiveAccountsSkeleton = async () => {
  const t = await getTranslations('accounts.route')
  return (
    <div
      className="flex flex-col gap-8 min-h-[14rem]"
      aria-busy="true"
      aria-label={t('active_loading')}
    >
      <SectionSkeleton rowCount={2} />
      <SectionSkeleton rowCount={2} />
    </div>
  )
}
