import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { SidebarToggle } from './sidebar'

export const Header = async () => {
  const t = await getTranslations('common')
  const appName = t('app_name')

  return (
    <header className="grid grid-cols-3 items-center border-b border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <SidebarToggle />
        <Link href="/dashboard" className="font-semibold tracking-tight text-foreground">
          {appName}
        </Link>
      </div>

      <nav className="flex items-center justify-center gap-6">
        <Link
          href="/accounts"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cuentas
        </Link>
        <Link
          href="/cards"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Tarjetas
        </Link>
        <Link
          href="/transactions"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Movimientos
        </Link>
      </nav>

      <div />
    </header>
  )
}
