import { RecurrencesHeader } from './_components/recurrences-header'

const RecurringLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex max-w-3xl flex-col gap-6">
    <RecurrencesHeader />
    {children}
  </div>
)

export default RecurringLayout
