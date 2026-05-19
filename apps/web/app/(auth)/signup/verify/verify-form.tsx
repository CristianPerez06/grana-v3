'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OtpVerifyForm } from '@/app/(auth)/_components/otp-verify-form'

export const SignupVerifyForm = ({ email }: { email: string }) => {
  const router = useRouter()
  const supabase = createClient()

  const onVerified = async () => {
    // Force a re-login so the user proves they know their password.
    await supabase.auth.signOut()
    router.replace('/login?message=account_confirmed')
  }

  return <OtpVerifyForm email={email} type="signup" onVerified={onVerified} />
}
