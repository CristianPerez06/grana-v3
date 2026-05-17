import Link from 'next/link'

const SettingsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Inicio
        </Link>
        <span>/</span>
        <span className="text-foreground">Configuración</span>
      </nav>
      {children}
    </div>
  )
}

export default SettingsLayout
