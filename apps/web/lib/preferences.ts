import { cookies } from 'next/headers'

export const SHOW_CENTS_COOKIE = 'show_cents'

export const getShowCents = async (): Promise<boolean> => {
  const cookieStore = await cookies()
  return cookieStore.get(SHOW_CENTS_COOKIE)?.value === 'true'
}
