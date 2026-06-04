import { AccountsHeader } from './_components/accounts-header'

const AccountsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-6">
    <AccountsHeader />
    {children}
  </div>
)

export default AccountsLayout
