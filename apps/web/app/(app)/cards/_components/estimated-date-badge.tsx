import { useTranslations } from 'next-intl'

type Props = {
  className?: string
}

export const EstimatedDateBadge = ({ className = '' }: Props) => {
  const t = useTranslations('cards')
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}
      title={t('period.estimated_tooltip')}
    >
      <span>📅</span>
      <span>{t('period.estimated_badge')}</span>
    </span>
  )
}
