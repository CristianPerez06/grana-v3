import { Suspense } from 'react'
import { TxBackLink } from './_components/tx-back-link'

const TransactionDetailLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-4 max-w-lg mx-auto">
    <Suspense fallback={<div className="px-3.5 pt-3.5 pb-1.5" aria-hidden />}>
      <TxBackLink />
    </Suspense>
    {children}
  </div>
)

export default TransactionDetailLayout
