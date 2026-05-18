import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NovatoOnboardingForm } from './_components/novato-onboarding-form'

const OnboardingPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col gap-8 max-w-md mx-auto">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Bienvenido a Grana 👋</h1>
        <p className="text-muted-foreground text-sm">
          Para empezar, necesito saber una sola cosa sobre tu tarjeta.
        </p>
      </div>

      <NovatoOnboardingForm />
    </div>
  )
}

export default OnboardingPage
