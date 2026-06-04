import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'

export const ArchivedCardsSkeleton = async () => {
  const t = await getTranslations('cards.route')
  return (
    <Card
      className="min-h-[3rem]"
      aria-busy="true"
      aria-label={t('archived_loading')}
      asChild
    >
      <div className="px-5 py-4">
        <span className="block h-4 w-32 rounded bg-muted/70 animate-pulse" />
      </div>
    </Card>
  )
}
