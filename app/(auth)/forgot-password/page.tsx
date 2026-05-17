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
import { ForgotPasswordForm } from './forgot-password-form'

const ForgotPasswordPage = async () => {
  await redirectIfAuthenticated()
  const t = await getTranslations('auth.forgot')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="link" size="sm" asChild>
          <Link href="/login">{t('back_to_login')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default ForgotPasswordPage
