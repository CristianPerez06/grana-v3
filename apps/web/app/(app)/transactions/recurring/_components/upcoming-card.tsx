'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'

/**
 * WHAT IS COMING, capped so the page underneath stays reachable.
 *
 * The second window used to cover what was left of the month — six days by the
 * 25th — so however many rows it had, it had few. Widening it to 30 running days
 * fixed the horizon and multiplied the rows: sixteen of them push the rule list
 * far enough down that someone who came here to EDIT A RULE has to scroll past a
 * card they were not looking for. The cost of the fix landed on a different
 * screen than the fix.
 *
 * So both cards show five and offer the rest. Both, not just the long one: the
 * short card is short today and full next week, and a cap that applies to one of
 * two side-by-side cards reads as a glitch rather than a rule.
 *
 * Expanding is a TOGGLE. What must not happen is the list folding itself back
 * while someone reads it; a control they press is the opposite of that, and
 * without it thirteen open rows are exactly the wall the cap exists to remove.
 */
const VISIBLE_ROWS = 5

type Props = {
  title: string
  /** Rendered by the server component — this one only decides how many show. */
  rows: ReactNode[]
  emptyLabel: string
}

export const UpcomingCard = ({ title, rows, emptyLabel }: Props) => {
  const tRec = useTranslations('recurrences')
  const [expanded, setExpanded] = useState(false)
  const hidden = rows.length - VISIBLE_ROWS
  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS)

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card">
      {/* Sólo el título. La nota que explicaba que se puede registrar o vincular
          se fue cuando cada fila pasó a tener sus dos botones: con la acción a la
          vista, la frase repite lo que el botón ya dice y le roba la mitad de la
          línea al título. */}
      <div className="px-5 pb-2.5 pt-4">
        <span className="text-[14px] font-bold tracking-[-0.01em] text-text">{title}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-[13px] text-text-muted">{emptyLabel}</p>
      ) : (
        <>
          <div className="pb-1.5">{shown}</div>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className="w-full border-t border-[var(--border-soft)] px-5 py-3 text-left text-[13px] font-semibold text-text-muted transition-colors hover:bg-page/40 hover:text-text"
            >
              {/* The count is in the button, so the size of what you are about to
                  open is known before you open it. */}
              {expanded ? tRec('upcoming.show_less') : tRec('upcoming.show_rest', { count: hidden })}
            </button>
          )}
        </>
      )}
    </div>
  )
}
