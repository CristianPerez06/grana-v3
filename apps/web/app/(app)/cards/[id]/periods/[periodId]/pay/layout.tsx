type Props = {
  children: React.ReactNode
}

// The rich header (card mark + statement context) is rendered in page.tsx, which
// has the card + period data. This layout only owns the centered form column.
const PayPeriodLayout = ({ children }: Props) => {
  return <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">{children}</div>
}

export default PayPeriodLayout
