'use client'

import { useRouter } from 'next/navigation'
import { OtpVerifyForm } from '@/app/(auth)/_components/otp-verify-form'

export const RecoveryVerifyForm = ({ email }: { email: string }) => {
  const router = useRouter()

  const onVerified = () => {
    router.replace('/reset-password')
  }

  return <OtpVerifyForm email={email} type="recovery" onVerified={onVerified} />
}
