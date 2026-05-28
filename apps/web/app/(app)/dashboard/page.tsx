import { formatDateISO, getTodayAR } from '@/lib/date'
import { QuickAddFab } from '@/lib/transactions/components/quick-add-fab'
import { DashboardContent } from './_components/dashboard-content'
import { DashboardHeader } from './_components/dashboard-header'
import { EyeMaskProvider } from './_components/eye-mask-context'

const DashboardPage = () => {
  const todayISO = formatDateISO(getTodayAR())

  return (
    <EyeMaskProvider>
      <DashboardHeader todayISO={todayISO} />
      <DashboardContent />
      <QuickAddFab />
    </EyeMaskProvider>
  )
}

export default DashboardPage
