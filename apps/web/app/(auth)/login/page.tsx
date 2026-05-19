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
