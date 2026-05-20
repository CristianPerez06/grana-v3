import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export const WelcomeFirstMoveCard = async () => {
  const t = await getTranslations('dashboard.welcome_card')

  return (
    <section className="rounded-2xl border border-emerald/30 bg-emerald/5 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald/15 text-emerald">
          <Sparkles size={20} />
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-text">{t('title')}</h2>
          <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
          <Link
            href="/accounts"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-deep"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </section>
  )
}
