import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { CurvedNavyContainer } from '@/components/layout/curved-navy-container'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { ForgotPasswordForm } from './forgot-password-form'

const ForgotPasswordPage = async () => {
  await redirectIfAuthenticated()
  const t = await getTranslations('auth.forgot')
  const tc = await getTranslations('common')

  return (
    <CurvedNavyContainer
      title={t('title')}
      subtitle={t('description')}
      showBack
      backHref="/login"
      backLabel={tc('back')}
    >
      <ForgotPasswordForm />
      <div className="mt-6 flex justify-center">
        <Button variant="link" size="sm" asChild>
          <Link href="/login">{t('back_to_login')}</Link>
        </Button>
      </div>
    </CurvedNavyContainer>
  )
}

export default ForgotPasswordPage
