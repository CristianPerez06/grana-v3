import { MovementDrawerLoader } from './_components/movement-drawer-loader'
import { TransactionsHeader } from './_components/transactions-header'

const TransactionsLayout = ({ children }: { children: React.ReactNode }) => (
  <MovementDrawerLoader>
    <div className="flex max-w-3xl flex-col gap-6 pb-24 sm:pb-0">
      <TransactionsHeader />
      {children}
    </div>
  </MovementDrawerLoader>
)

export default TransactionsLayout
