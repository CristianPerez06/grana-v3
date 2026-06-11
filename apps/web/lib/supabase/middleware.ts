import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, localeCookieName } from '@/lib/i18n/config'
import { getProjectJwks } from '@/lib/supabase/jwks'

const ONE_YEAR = 60 * 60 * 24 * 365

// Session validation is local (JWT signature verified against the project's
// asymmetric signing key, JWKS cached at module scope in lib/supabase/jwks)
// instead of a network round-trip to the Auth server per request. Trade-off,
// per the web-data-access spec: a revoked session stays valid until the
// access token expires. Token refresh still goes to the Auth server —
// getClaims() refreshes through getSession() when expired.

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: do not run any other code between createServerClient and getClaims.
  const jwks = await getProjectJwks()
  const { data: claimsData } = await supabase.auth.getClaims(
    undefined,
    jwks ? { jwks } : undefined,
  )
  const claims = claimsData?.claims ?? null

  // Bootstrap locale cookie so the first render has a deterministic value.
  if (!request.cookies.get(localeCookieName)) {
    response.cookies.set(localeCookieName, defaultLocale, {
      maxAge: ONE_YEAR,
      sameSite: 'lax',
      path: '/',
    })
  } else {
    // Sanity check: if cookie holds an unsupported value, reset to default.
    const value = request.cookies.get(localeCookieName)?.value
    if (!isLocale(value)) {
      response.cookies.set(localeCookieName, defaultLocale, {
        maxAge: ONE_YEAR,
        sameSite: 'lax',
        path: '/',
      })
    }
  }

  // A recovery session is identified by the JWT amr claim containing
  // method=otp. Supabase tags sessions created via verifyOtp(type='recovery')
  // this way. The claims come signature-verified from getClaims, so no manual
  // token decoding is needed.
  const isRecoverySession = (claims?.amr ?? []).some((entry) =>
    typeof entry === 'string' ? entry === 'otp' : entry.method === 'otp',
  )

  const pathname = request.nextUrl.pathname
  const protectedPrefixes = ['/dashboard', '/account', '/accounts', '/cards', '/onboarding']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  if (!claims && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (claims && isRecoverySession && !pathname.startsWith('/reset-password')) {
    const url = request.nextUrl.clone()
    url.pathname = '/reset-password'
    return NextResponse.redirect(url)
  }

  // Force the onboarding wizard on authenticated users who haven't finished
  // it. The check only runs on protected app routes (not on /onboarding/*
  // itself, not on /login, /signup, /auth/callback, etc.) to avoid loops.
  if (claims && isProtected && !isOnboardingRoute && !isRecoverySession) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', claims.sub)
      .maybeSingle()

    if (profile && profile.onboarding_completed_at === null) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/welcome'
      return NextResponse.redirect(url)
    }
  }

  return response
}
