import { SavingsBreakdownSkeleton, SavingsHeadlineSkeleton } from './_components/savings-skeletons'

const SavingsLoading = () => (
  <div className="flex flex-col">
    <SavingsHeadlineSkeleton />
    <SavingsBreakdownSkeleton />
  </div>
)

export default SavingsLoading
