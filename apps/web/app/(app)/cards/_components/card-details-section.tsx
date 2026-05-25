import { useTranslations } from 'next-intl'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  createdAt: string
  archivedAt?: string | null
}

export const CardDetailsSection = ({ createdAt, archivedAt }: Props) => {
  const t = useTranslations('cards')
  return (
    <section className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>{t('labels.creation_date')}</span>
        <span>{formatDate(createdAt.slice(0, 10))}</span>
      </div>
      {archivedAt && (
        <div className="flex items-center justify-between">
          <span>{t('labels.archived_date')}</span>
          <span>{formatDate(archivedAt.slice(0, 10))}</span>
        </div>
      )}
    </section>
  )
}
