import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/layout/auth-shell'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { ForgotPasswordForm } from './forgot-password-form'

const ForgotPasswordPage = async () => {
  await redirectIfAuthenticated()
  const t = await getTranslations('auth.forgot')

  return (
    <AuthShell title={t('title')} subtitle={t('description')}>
      <ForgotPasswordForm />
      <div className="mt-6 flex justify-center">
        <Button variant="link" size="sm" asChild>
          <Link href="/login">{t('back_to_login')}</Link>
        </Button>
      </div>
    </AuthShell>
  )
}

export default ForgotPasswordPage
