const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  createdAt: string
  archivedAt?: string | null
}

export const CardDetailsSection = ({ createdAt, archivedAt }: Props) => (
  <section className="flex flex-col gap-1 text-xs text-muted-foreground">
    <div className="flex items-center justify-between">
      <span>Fecha de alta</span>
      <span>{formatDate(createdAt.slice(0, 10))}</span>
    </div>
    {archivedAt && (
      <div className="flex items-center justify-between">
        <span>Archivada</span>
        <span>{formatDate(archivedAt.slice(0, 10))}</span>
      </div>
    )}
  </section>
)
