import type { ReactNode } from 'react'

// Card-like wrapper for a group of TxDetailRow items. The optional `title`
// renders as a small uppercase eyebrow above the card (e.g. "DETALLES").

type Props = {
  title?: string
  children: ReactNode
}

export const TxDetailGroup = ({ title, children }: Props) => (
  <div>
    {title && (
      <div className="px-5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.6px] text-text-soft">
        {title}
      </div>
    )}
    <div className="mx-4 rounded-[18px] border border-border bg-card overflow-hidden">
      {children}
    </div>
  </div>
)
