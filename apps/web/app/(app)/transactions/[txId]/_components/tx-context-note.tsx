// Editorial in-context note rendered between the TxHero and the first
// TxDetailGroup. Surfaces grana-specific behaviour the user otherwise has to
// infer (off-ledger card spending, pending reimbursements). Plain text, no
// border, no bg, no icon — a soft narrative line, not a banner.
//
// The variant resolution lives in `resolve-context-variant.ts`; the i18n
// strings under `transactions.detail.context.*`. The orchestrator decides
// which copy to pass in; this component only formats and renders.

type Props = {
  /** i18n-resolved copy. When null/empty, the component renders nothing. */
  copy: string | null
}

export const TxContextNote = ({ copy }: Props) => {
  if (!copy) return null
  return (
    <p className="px-5 text-[13px] text-text-muted leading-relaxed text-center max-w-[420px] mx-auto">
      {copy}
    </p>
  )
}
