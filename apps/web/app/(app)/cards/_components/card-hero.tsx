import { formatARS } from '@grana/i18n-messages'

type Props = {
  name: string
  institutionName: string | null
  creditLimit: number | null
  showCents?: boolean
}

export const CardHero = ({ name, institutionName, creditLimit, showCents = false }: Props) => (
  <div className="flex flex-col gap-1">
    <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
    <p className="text-sm text-muted-foreground">
      {[institutionName, creditLimit !== null ? `Límite ${formatARS(creditLimit, showCents)}` : null]
        .filter(Boolean)
        .join(' · ')}
    </p>
  </div>
)
