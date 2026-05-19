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

  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('no_email_title')}</CardTitle>
          <CardDescription>{t('no_email_body')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/forgot-password">{t('no_email_title')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recovery_title')}</CardTitle>
        <CardDescription>{t('recovery_description', { email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <RecoveryVerifyForm email={email} />
      </CardContent>
    </Card>
  )
}

export default RecoveryVerifyPage
