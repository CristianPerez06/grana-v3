import Link from 'next/link'
import type { PageHeaderProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

/**
 * Page-level heading. Renders two different treatments depending on width:
 *
 * - **`md` and up** — the header lives in the content flow with no surface of
 *   its own, the way it always has on desktop.
 * - **Below `md`** — a full-bleed navy band that eats the safe area, mirroring
 *   the native `PageHeader` (`apps/mobile/components/ui/PageHeader.tsx`). Web
 *   in a mobile viewport and the native app are meant to read as the same
 *   product; see `docs/design/web-mobile-chrome/`.
 *
 * ⚠️ **Coupled to the shell's content padding.** The navy band is full-bleed,
 * but this component renders *inside* `<main>`'s padded wrapper
 * (`mx-auto max-w-5xl px-4 py-5 …` in `app-shell.tsx`). The negative margins
 * below cancel exactly that padding, so `-mx-4 -mt-5` must stay in sync with
 * the wrapper's `px-4 py-5`. Change one and the band stops reaching the edges
 * — nothing fails loudly. `app-shell.tsx` carries the matching note.
 */
export const PageHeader = ({
  title,
  description,
  descriptionExtras,
  backLink,
  actions,
  className,
}: PageHeaderProps) => {
  const titleAndDescription = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight break-words text-white md:text-foreground">
        {title}
      </h1>
      {(description || descriptionExtras) && (
        <p className="text-sm text-navy-muted md:text-muted-foreground">
          {description}
          {descriptionExtras}
        </p>
      )}
    </div>
  )

  const titleBlock = actions ? (
    // Only the title + actions sit in the row that decides wrapping, so the
    // (potentially long) description never inflates the measurement and pushes
    // the actions down on its own. On mobile the actions stay pinned top-right
    // next to the title when they fit; when the title + actions are too wide to
    // share a line, the actions wrap to their own line (the previous stacked
    // look) instead of squeezing the title. The description renders full-width
    // below the row.
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words text-white md:text-foreground">
          {title}
        </h1>
        <div className="shrink-0">{actions}</div>
      </div>
      {(description || descriptionExtras) && (
        <p className="text-sm text-navy-muted md:text-muted-foreground">
          {description}
          {descriptionExtras}
        </p>
      )}
    </div>
  ) : (
    titleAndDescription
  )

  return (
    <div
      className={cn(
        // Below `md`: break out of the wrapper padding so the navy reaches the
        // viewport edges and under the notch. Above it: inert.
        '-mx-4 -mt-5 bg-navy pt-safe-top md:mx-0 md:mt-0 md:bg-transparent md:pt-0',
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4 md:p-0">
        {backLink ? (
          <div className="flex items-center gap-3">
            <Link
              href={backLink.href}
              className="text-sm text-navy-muted transition-colors hover:text-white md:text-muted-foreground md:hover:text-foreground"
            >
              ← {backLink.label}
            </Link>
          </div>
        ) : (
          // The back-link's slot is reserved even when there is no link, so the
          // band keeps the same height across every route of a section and the
          // chrome does not jump while navigating. Mirrors the native
          // `<View className="h-5" />`. Desktop has no band to keep steady.
          <div className="h-5 md:hidden" aria-hidden />
        )}
        {titleBlock}
      </div>
    </div>
  )
}
