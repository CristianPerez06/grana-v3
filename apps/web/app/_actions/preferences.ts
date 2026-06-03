'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { EYE_MASKED_COOKIE, SHOW_CENTS_COOKIE, SIDEBAR_COLLAPSED_COOKIE } from '@/lib/preferences'

export const setShowCents = async (value: boolean) => {
  const cookieStore = await cookies()
  cookieStore.set(SHOW_CENTS_COOKIE, String(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}

export const setSidebarCollapsed = async (value: boolean) => {
  const cookieStore = await cookies()
  cookieStore.set(SIDEBAR_COLLAPSED_COOKIE, String(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}

export const setEyeMasked = async (value: boolean) => {
  const cookieStore = await cookies()
  cookieStore.set(EYE_MASKED_COOKIE, String(value), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
