import { formatDateISO, getTodayAR } from '@/lib/date'
import { getEyeMasked } from '@/lib/preferences'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { DashboardContent } from './_components/dashboard-content'
import { DashboardHeader } from './_components/dashboard-header'
import { EyeMaskProvider } from './_components/eye-mask-context'

const DashboardPage = async () => {
  const todayISO = formatDateISO(getTodayAR())
  const eyeMasked = await getEyeMasked()

  return (
    <EyeMaskProvider initialMasked={eyeMasked}>
      <div className="pb-24 sm:pb-0">
        <DashboardHeader todayISO={todayISO} />
        <DashboardContent />
      </div>
      <QuickAddFab />
    </EyeMaskProvider>
  )
}

export default DashboardPage
