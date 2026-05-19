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
      <Card>
        <CardHeader>
          <CardTitle>{t('no_email_title')}</CardTitle>
          <CardDescription>{t('no_email_body')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/signup">{t('no_email_title')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('signup_title')}</CardTitle>
        <CardDescription>{t('signup_description', { email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupVerifyForm email={email} />
      </CardContent>
    </Card>
  )
}

export default SignupVerifyPage
