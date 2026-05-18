import Link from 'next/link'
import { getShowCents } from '@/lib/preferences'
import { ShowCentsToggle } from './_components/show-cents-toggle'

const SettingsPage = async () => {
  const showCents = await getShowCents()

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>

      {/* Display */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Visualización
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <ShowCentsToggle initialValue={showCents} />
        </div>
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Categorías
        </h2>
        <Link
          href="/settings/categories"
          className="rounded-lg border border-border bg-card p-4 text-sm font-medium hover:shadow-sm transition-shadow flex items-center justify-between"
        >
          Administrar categorías
          <span className="text-muted-foreground">→</span>
        </Link>
      </section>
    </div>
  )
}

export default SettingsPage
