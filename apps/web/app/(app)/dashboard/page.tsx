import { formatDateISO, getTodayAR } from '@/lib/date'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { DashboardContent } from './_components/dashboard-content'
import { DashboardHeader } from './_components/dashboard-header'
import { EyeMaskProvider } from './_components/eye-mask-context'

const DashboardPage = () => {
  const todayISO = formatDateISO(getTodayAR())

  return (
    <EyeMaskProvider>
      <div className="pb-24 sm:pb-0">
        <DashboardHeader todayISO={todayISO} />
        <DashboardContent />
      </div>
      <QuickAddFab />
    </EyeMaskProvider>
  )
}

export default DashboardPage
