import { formatDateISO, getTodayAR } from '@/lib/date'
import { getEyeMasked } from '@/lib/preferences'
import { DashboardHeader } from './_components/dashboard-header'
import { EyeMaskProvider } from './_components/eye-mask-context'

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const todayISO = formatDateISO(getTodayAR())
  const eyeMasked = await getEyeMasked()

  return (
    <EyeMaskProvider initialMasked={eyeMasked}>
      <DashboardHeader todayISO={todayISO} />
      <div className="pb-24 sm:pb-0">{children}</div>
    </EyeMaskProvider>
  )
}

export default DashboardLayout
