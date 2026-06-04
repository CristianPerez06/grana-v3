import { formatDateISO, getTodayAR } from '@/lib/date'
import { getEyeMasked } from '@/lib/preferences'
import { DashboardHeader } from './_components/dashboard-header'
import { DashboardMonthProvider } from './_components/dashboard-month-context'
import { EyeMaskProvider } from './_components/eye-mask-context'

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const today = getTodayAR()
  const todayISO = formatDateISO(today)
  const eyeMasked = await getEyeMasked()

  return (
    <EyeMaskProvider initialMasked={eyeMasked}>
      <DashboardMonthProvider
        currentYear={today.getFullYear()}
        currentMonth={today.getMonth() + 1}
      >
        <DashboardHeader todayISO={todayISO} />
        <div className="pb-24 sm:pb-0">{children}</div>
      </DashboardMonthProvider>
    </EyeMaskProvider>
  )
}

export default DashboardLayout
