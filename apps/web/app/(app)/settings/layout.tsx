import { SettingsHeader } from './_components/settings-header'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6 max-w-[760px]">
    <SettingsHeader />
    {children}
  </div>
)

export default SettingsLayout
