import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

const CardDetailLayout = async ({ children }: { children: React.ReactNode }) => {
  const t = await getTranslations('cards')

  return (
    <div className="flex max-w-[1080px] flex-col gap-5">
      <Link
        href="/cards"
        className="text-[13px] font-extrabold text-text-muted transition-colors hover:text-foreground"
      >
        {`← ${t('back_label')}`}
      </Link>
      {children}
    </div>
  )
}

export default CardDetailLayout
