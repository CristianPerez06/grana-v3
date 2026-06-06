import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const CardDetailLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('cards')

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/cards"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {`← ${t('back_label')}`}
      </Link>
      {children}
    </div>
  )
}

export default CardDetailLayout
