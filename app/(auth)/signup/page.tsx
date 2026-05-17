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
import { SignupForm } from './signup-form'

const SignupPage = async () => {
  await redirectIfAuthenticated()
  const t = await getTranslations('auth.signup')
  const common = await getTranslations('auth.signup')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="link" size="sm" asChild>
          <Link href="/login">{common('have_account')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default SignupPage
