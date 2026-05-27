import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/layout/auth-shell'
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

  if (!email) {
    return (
      <AuthShell title={t('no_email_title')} subtitle={t('no_email_body')}>
        <Button asChild className="w-full">
          <Link href="/signup">{t('no_email_title')}</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={t('signup_title')}
      subtitle={t('signup_description', { email })}
    >
      <SignupVerifyForm email={email} />
    </AuthShell>
  )
}

export default SignupVerifyPage
