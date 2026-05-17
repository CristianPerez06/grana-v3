'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { isLocale, localeCookieName } from '@/lib/i18n/config'

const ONE_YEAR = 60 * 60 * 24 * 365

export const setLocaleAction = async (locale: unknown) => {
  if (!isLocale(locale)) return

  const cookieStore = await cookies()
  cookieStore.set(localeCookieName, locale, {
    maxAge: ONE_YEAR,
    sameSite: 'lax',
    path: '/',
  })

  revalidatePath('/', 'layout')
}
