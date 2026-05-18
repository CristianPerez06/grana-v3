import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { defaultLocale, isLocale, localeCookieName } from '@/lib/i18n/config'

const RECOVERY_COOKIE = 'recovery_in_progress'
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

  // Detect recovery session with two independent signals:
  //   1) recovery_in_progress cookie set by /auth/callback on PKCE recovery
  //   2) JWT amr claim containing method=otp (Supabase marks recovery sessions this way)
  // Either alone is fragile (cookie can be missing; amr=otp also fires on signup OTP).
  // Together they cover each other and let us safely gate the user inside /reset-password.
  const recoveryCookie = request.cookies.get(RECOVERY_COOKIE)?.value === '1'
  const amrMethods = decodeAmr(session?.access_token)
  const amrIsOtp = amrMethods.includes('otp')
  const amrIsPassword = amrMethods.includes('password')

  let isRecoverySession = recoveryCookie || amrIsOtp

  // Cleanup: a fresh email+password login (amr=password) with a stale recovery
  // cookie hanging around — drop the cookie so the user can navigate freely.
  if (recoveryCookie && amrIsPassword) {
    isRecoverySession = false
    response.cookies.set(RECOVERY_COOKIE, '', { maxAge: 0, path: '/' })
  }

  const pathname = request.nextUrl.pathname
  const protectedPrefixes = ['/dashboard', '/account', '/accounts']
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (
    user &&
    isRecoverySession &&
    !pathname.startsWith('/reset-password') &&
    !pathname.startsWith('/auth/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/reset-password'
    return NextResponse.redirect(url)
  }

  return response
}
