import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { CurvedNavyContainer } from '@/components/layout/curved-navy-container'
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
  const tc = await getTranslations('common')

  if (!email) {
    return (
      <CurvedNavyContainer
        title={t('no_email_title')}
        subtitle={t('no_email_body')}
        showBack
        backHref="/forgot-password"
        backLabel={tc('back')}
      >
        <Button asChild className="w-full">
          <Link href="/forgot-password">{t('no_email_title')}</Link>
        </Button>
      </CurvedNavyContainer>
    )
  }

  return (
    <CurvedNavyContainer
      title={t('recovery_title')}
      subtitle={t('recovery_description', { email })}
      showBack
      backHref="/forgot-password"
      backLabel={tc('back')}
    >
      <RecoveryVerifyForm email={email} />
    </CurvedNavyContainer>
  )
}

export default RecoveryVerifyPage
