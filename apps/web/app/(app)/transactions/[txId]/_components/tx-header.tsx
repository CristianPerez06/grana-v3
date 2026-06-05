import type { ReactNode } from 'react'
import Link from 'next/link'

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
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {`← ${backLabel}`}
    </Link>
    {actions && <div>{actions}</div>}
  </div>
)
