import { cookies } from 'next/headers'

export const SHOW_CENTS_COOKIE = 'show_cents'
export const SIDEBAR_COLLAPSED_COOKIE = 'sidebar_collapsed'

export const getShowCents = async (): Promise<boolean> => {
  const cookieStore = await cookies()
  return cookieStore.get(SHOW_CENTS_COOKIE)?.value === 'true'
}

export const getSidebarCollapsed = async (): Promise<boolean> => {
  const cookieStore = await cookies()
  return cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === 'true'
}
