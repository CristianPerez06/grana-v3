import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { redirectIfAuthenticated } from '@/lib/auth/guards'
import { LoginForm } from './login-form'

type SearchParams = { message?: string; error?: string }

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) => {
  await redirectIfAuthenticated()
  const { message, error } = await searchParams
  const t = await getTranslations('auth.login')

  const initialNotice = ((): { variant: 'success' | 'error'; text: string } | null => {
    if (message === 'account_confirmed') {
      return { variant: 'success', text: t('confirmed_notice') }
    }
    if (error === 'auth_callback_failed') {
      return { variant: 'error', text: t('callback_error') }
    }
    return null
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm initialNotice={initialNotice} />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button variant="link" size="sm" asChild>
          <Link href="/forgot-password">{t('forgot')}</Link>
        </Button>
        <Button variant="link" size="sm" asChild>
          <Link href="/signup">{t('no_account')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default LoginPage
