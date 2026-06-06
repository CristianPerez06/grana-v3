import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const AccountDetailLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('accounts')

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <Link
        href="/accounts"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${t('title')}`}
      </Link>
      {children}
    </div>
  )
}

export default AccountDetailLayout
