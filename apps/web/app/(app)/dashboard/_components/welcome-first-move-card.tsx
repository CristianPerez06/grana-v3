import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const WelcomeFirstMoveCard = async () => {
  const t = await getTranslations('dashboard.welcome_card')

  return (
    <Card variant="emerald">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald/15 text-emerald">
            <Sparkles size={20} />
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-text">{t('title')}</h2>
            <p className="mt-1 text-sm text-text-muted">{t('description')}</p>
            <Button asChild variant="primary" className="mt-3 w-auto">
              <Link href="/accounts">{t('cta')}</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
