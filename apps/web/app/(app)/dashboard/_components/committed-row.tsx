import { MaskedAmount } from './masked-amount'

type Props = {
  label: string
  amount: number
  currency: 'ARS' | 'USD'
  /** The first row of a list drops its top rule — the panel header is the rule. */
  first?: boolean
}

/** One listed commitment inside a group panel: name on the left, amount right. */
export const CommittedRow = ({ label, amount, currency, first = false }: Props) => (
  <div
    className={`flex items-center justify-between gap-3 py-2 ${first ? '' : 'border-t border-border-soft'}`}
  >
    <span className="min-w-0 truncate text-[12.5px] font-semibold text-text-muted">{label}</span>
    <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-text">
      <MaskedAmount amount={amount} currency={currency} showCentsOverride={currency === 'USD'} />
    </span>
  </div>
)
