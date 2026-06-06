import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const RecurrenceDetailLayout = async ({ children }: { children: React.ReactNode }) => {
  const tRec = await getTranslations('recurrences')

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <Link
        href="/transactions/recurring"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${tRec('title')}`}
      </Link>
      {children}
    </div>
  )
}

export default RecurrenceDetailLayout
