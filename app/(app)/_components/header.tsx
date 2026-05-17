import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LogoutButton } from './logout-button'

export const Header = async () => {
  const t = await getTranslations('common')

  return (
    <header className="flex justify-between items-center px-4 py-3 border-b border-border bg-background">
      <Link
        href="/dashboard"
        className="text-foreground font-semibold tracking-tight"
      >
        {t('app_name')}
      </Link>
      <LogoutButton />
    </header>
  )
}
