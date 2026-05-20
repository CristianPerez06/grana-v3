import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, localeCookieName } from '@/lib/i18n/config'

const ONE_YEAR = 60 * 60 * 24 * 365

type JwtAmrEntry = { method?: string }

const decodeAmr = (accessToken: string | undefined): string[] => {
  if (!accessToken) return []
  const parts = accessToken.split('.')
  if (parts.length < 2) return []
  try {
    const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=')
    const payload = JSON.parse(
      Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { amr?: JwtAmrEntry[] }
    return (payload.amr ?? [])
      .map((entry) => entry.method)
      .filter((method): method is string => Boolean(method))
  } catch {
    return []
  }
}

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

  // IMPORTANT: do not run any other code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const {
    data: { session },
  } = await supabase.auth.getSession()

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

  // A recovery session is identified by the JWT amr claim containing method=otp.
  // Supabase tags sessions created via verifyOtp(type='recovery') this way.
  const isRecoverySession = decodeAmr(session?.access_token).includes('otp')

  const pathname = request.nextUrl.pathname
  const protectedPrefixes = ['/dashboard', '/account', '/accounts', '/cards', '/onboarding']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isRecoverySession && !pathname.startsWith('/reset-password')) {
    const url = request.nextUrl.clone()
    url.pathname = '/reset-password'
    return NextResponse.redirect(url)
  }

  // Force the onboarding wizard on authenticated users who haven't finished
  // it. The check only runs on protected app routes (not on /onboarding/*
  // itself, not on /login, /signup, /auth/callback, etc.) to avoid loops.
  if (user && isProtected && !isOnboardingRoute && !isRecoverySession) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle()

    if (profile && profile.onboarding_completed_at === null) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/welcome'
      return NextResponse.redirect(url)
    }
  }

  return response
}
