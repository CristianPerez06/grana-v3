import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/layout/auth-shell'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { LoginForm } from './login-form'

type SearchParams = { message?: string }

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) => {
  await redirectIfAuthenticated()
  const { message } = await searchParams
  const t = await getTranslations('auth.login')

  const initialNotice =
    message === 'account_confirmed'
      ? { variant: 'success' as const, text: t('confirmed_notice') }
      : null

  return (
    <AuthShell title={t('header_title')} subtitle={t('description')}>
      <LoginForm initialNotice={initialNotice} />
      <div className="mt-6 flex flex-col items-center gap-1">
        <Button variant="link" size="sm" asChild>
          <Link href="/forgot-password">{t('forgot')}</Link>
        </Button>
        <Button variant="link" size="sm" asChild>
          <Link href="/signup">{t('no_account')}</Link>
        </Button>
      </div>
    </AuthShell>
  )
}

export default LoginPage
