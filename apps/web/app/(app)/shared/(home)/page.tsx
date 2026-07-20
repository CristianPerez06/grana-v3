import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getHousehold } from '@/lib/shared/queries'
import { Card } from '@/components/ui/card'
import { InviteCard } from '../_components/invite-card'
import { SetupForm } from '../setup/_components/setup-form'
import { HeroSectionContainer } from './_components/hero-section-container'
import { HeroSkeleton } from './_components/hero-skeleton'
import { DebtSection } from './_components/debt-section'
import { OutlookSection } from './_components/outlook-section'
import { TileSkeleton } from './_components/tile-skeleton'
import { TeaserSection } from './_components/teaser-section'
import { PendingSection } from './_components/pending-section'
import { RecentSectionContainer } from './_components/recent-section-container'
import { RecentSkeleton } from './_components/recent-skeleton'

// The household name + register CTA + settings icon + month navigator live in
// (home)/layout.tsx. Each section below streams behind its own Suspense with a
// shape-matched skeleton and owns its error state; the month navigator drives
// only the month-scoped sections (hero + últimos) via SharedMonthProvider.
export default async function SharedPage() {
  const t = await getTranslations('shared')
  const supabase = await createClient()
  const household = await getHousehold(supabase)

  if (!household) {
    return (
      <>
        <p className="text-sm text-text-muted">{t('setup.description')}</p>
        <SetupForm />
      </>
    )
  }

  if (household.members.length < 2) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm font-semibold text-text">{t('dashboard.waiting_title')}</p>
        <p className="text-xs text-text-muted">{t('dashboard.waiting_hint')}</p>
        <InviteCard />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSectionContainer />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2">
        <Suspense fallback={<TileSkeleton />}>
          <DebtSection />
        </Suspense>
        <Suspense fallback={<TileSkeleton />}>
          <OutlookSection />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <TeaserSection />
      </Suspense>

      <Suspense fallback={null}>
        <PendingSection />
      </Suspense>

      <Suspense
        fallback={
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-soft">
              {t('dashboard.recent_title')}
            </h2>
            <RecentSkeleton />
          </section>
        }
      >
        <RecentSectionContainer />
      </Suspense>
    </div>
  )
}
