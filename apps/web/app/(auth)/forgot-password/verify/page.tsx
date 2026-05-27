import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/layout/auth-shell'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { RecoveryVerifyForm } from './verify-form'

type SearchParams = { email?: string }

const RecoveryVerifyPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) => {
  await redirectIfAuthenticated()
  const { email } = await searchParams
  const t = await getTranslations('auth.verify')

  if (!email) {
    return (
      <AuthShell title={t('no_email_title')} subtitle={t('no_email_body')}>
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t('no_email_title')}</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('recovery_title')}
      subtitle={t('recovery_description', { email })}
    >
      <RecoveryVerifyForm email={email} />
    </AuthShell>
  )
}

export default RecoveryVerifyPage
