import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const OnboardingWizardLayout = async ({
  children,
}: {
  children: React.ReactNode
}) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto mt-16 w-full max-w-md px-4 pb-16">{children}</div>
  )
}

export default OnboardingWizardLayout
