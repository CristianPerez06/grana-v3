import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams

  return (
    <div className="mx-auto mt-20 w-full max-w-sm px-4">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Log in or create an account to continue.
          </CardDescription>
        </CardHeader>
        <form>
          <CardContent className="flex flex-col gap-4">
            <FormField
              label="Email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
            <FormField
              label="Password"
              name="password"
              type="password"
              required
            />
            {error && <Alert variant="error">{error}</Alert>}
            {message && <Alert variant="success">{message}</Alert>}
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button formAction={login} className="w-full">
              Log in
            </Button>
            <Button
              formAction={signup}
              variant="secondary"
              className="w-full"
            >
              Sign up
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
