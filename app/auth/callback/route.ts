import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TEN_MINUTES = 60 * 10

const failureRedirect = (origin: string) =>
  NextResponse.redirect(`${origin}/login?error=auth_callback_failed`, 303)

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorCode = searchParams.get('error_code')

  if (errorParam || errorCode) return failureRedirect(origin)

  const supabase = await createClient()

  // OTP flow — signup email confirmation (and other OTP types).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'recovery' | 'email_change' | 'invite',
      token_hash: tokenHash,
    })
    if (error) return failureRedirect(origin)

    if (type === 'signup') {
      // Force a re-login so the user proves they know their password.
      await supabase.auth.signOut()
      return NextResponse.redirect(
        `${origin}/login?message=account_confirmed`,
        303,
      )
    }

    return NextResponse.redirect(`${origin}${next}`, 303)
  }

  // PKCE flow — password recovery (and any other code-based exchange).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return failureRedirect(origin)

    const response = NextResponse.redirect(`${origin}${next}`, 303)
    if (next === '/reset-password') {
      response.cookies.set('recovery_in_progress', '1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: TEN_MINUTES,
        path: '/',
      })
    }
    return response
  }

  return failureRedirect(origin)
}
