import { TransactionsHeader } from './_components/transactions-header'

const TransactionsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex max-w-[1080px] flex-col gap-6 pb-24 sm:pb-0">
    <TransactionsHeader />
    {children}
  </div>
)

export default TransactionsLayout
