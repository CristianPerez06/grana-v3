import { HeroSkeleton } from './_components/hero-skeleton'
import { RecentSkeleton } from './_components/recent-skeleton'
import { TileSkeleton } from './_components/tile-skeleton'

// Route-level fallback for the section area only — the header chrome (title,
// register CTA, settings, month navigator) lives in the persistent layout and
// stays visible. Mirrors the page's per-section Suspense fallbacks so nothing
// shifts as sections stream in.
const SharedHomeLoading = () => (
  <div className="flex flex-col gap-4" aria-busy="true">
    <HeroSkeleton />
    <div className="grid gap-4 sm:grid-cols-2">
      <TileSkeleton />
      <TileSkeleton />
    </div>
    <section className="flex flex-col gap-3">
      <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
      <RecentSkeleton />
    </section>
  </div>
)

export default SharedHomeLoading
