import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const AccountDetailLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('accounts')

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <Link
        href="/accounts"
        className="text-[13px] font-extrabold text-text-muted hover:text-foreground transition-colors"
      >
        {`← ${t('title')}`}
      </Link>
      {children}
    </div>
  )
}

export default AccountDetailLayout
