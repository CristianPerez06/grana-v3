import Link from 'next/link'

export const EmptyAccountsState = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <p className="text-lg font-medium text-foreground">Todavía no tenés cuentas</p>
    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
      Creá tu primera cuenta para empezar a registrar tus movimientos.
    </p>
    <Link
      href="/accounts/new"
      className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      + Crear cuenta
    </Link>
  </div>
)
