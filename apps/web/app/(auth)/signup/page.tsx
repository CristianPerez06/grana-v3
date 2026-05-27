import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/layout/auth-shell'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { SignupForm } from './signup-form'

const SignupPage = async () => {
  await redirectIfAuthenticated()
  const t = await getTranslations('auth.signup')

  return (
    <AuthShell title={t('title')} subtitle={t('description')}>
      <SignupForm />
      <div className="mt-6 flex justify-center">
        <Button variant="link" size="sm" asChild>
          <Link href="/login">{t('have_account')}</Link>
        </Button>
      </div>
    </AuthShell>
  )
}

export default SignupPage
