import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Header of the transaction detail. Back arrow on the left (icon-only, no
// label — the back of the browser carries the same semantic and the label
// "← Visa Galicia" / "← Movimientos" eats real estate without adding info).
// Right slot reserved for the actions menu (kebab).

type Props = {
  backHref: string
  backLabel: string
  /** Slot for the actions menu (`TxActionsMenu`) or nothing. */
  actions?: ReactNode
}

export const TxHeader = ({ backHref, backLabel, actions }: Props) => (
  <div className="flex items-center justify-between px-3.5 pt-3.5 pb-1.5">
    <Link
      href={backHref}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] text-text hover:bg-muted/40 transition-colors"
      aria-label={backLabel}
    >
      <ArrowLeft size={20} strokeWidth={2} />
    </Link>
    <div className="flex-1" />
    {actions && <div>{actions}</div>}
  </div>
)
