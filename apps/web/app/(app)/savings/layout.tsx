import { SavingsHeader } from './_components/savings-header'

const SavingsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6">
    <SavingsHeader />
    {children}
  </div>
)

export default SavingsLayout
