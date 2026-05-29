import type { ReactNode } from 'react'

// Single row inside a TxDetailGroup. Two slots for the value:
// - `value` for the common case (a string).
// - `valueNode` for richer rendering (a Link, a chip, multi-line, etc.).
// Provide one, not both. The component prefers `valueNode` when present.

type Props = {
  icon: ReactNode
  label: string
  value?: string
  valueNode?: ReactNode
}

export const TxDetailRow = ({ icon, label, value, valueNode }: Props) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-border-soft last:border-b-0">
    <div className="size-8 shrink-0 rounded-[10px] bg-muted flex items-center justify-center text-text-soft">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.5px] text-text-soft mb-0.5">
        {label}
      </div>
      {valueNode ?? (
        <div className="text-[13.5px] font-semibold text-text tracking-[-0.1px]">
          {value}
        </div>
      )}
    </div>
  </div>
)
