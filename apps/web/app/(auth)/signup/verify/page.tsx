import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { CurvedNavyContainer } from '@/components/layout/curved-navy-container'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { SignupVerifyForm } from './verify-form'

type SearchParams = { email?: string }

const SignupVerifyPage = async ({
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
        backHref="/signup"
        backLabel={tc('back')}
      >
        <Button asChild className="w-full">
          <Link href="/signup">{t('no_email_title')}</Link>
        </Button>
      </CurvedNavyContainer>
    )
  }

  return (
    <CurvedNavyContainer
      title={t('signup_title')}
      subtitle={t('signup_description', { email })}
      showBack
      backHref="/signup"
      backLabel={tc('back')}
    >
      <SignupVerifyForm email={email} />
    </CurvedNavyContainer>
  )
}

export default SignupVerifyPage
