import { getTranslations } from 'next-intl/server'

export const ArchivedAccountsSkeleton = async () => {
  const t = await getTranslations('accounts.route')
  return (
    <section
      className="flex flex-col gap-3 min-h-[3rem]"
      aria-busy="true"
      aria-label={t('archived_loading')}
    >
      <div className="flex items-baseline gap-2 px-1">
        <span className="h-3 w-24 rounded bg-muted animate-pulse" />
        <span className="h-3 w-6 rounded bg-muted/70 animate-pulse" />
      </div>
      <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-dashed border-border-soft bg-card">
        <div className="flex min-h-[78px] items-center gap-4 px-5 py-4">
          <span className="size-10 shrink-0 rounded-full bg-muted/70 animate-pulse" />
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <span className="h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
          </div>
          <span className="h-3.5 w-20 shrink-0 rounded bg-muted/70 animate-pulse" />
        </div>
      </div>
    </section>
  )
}
