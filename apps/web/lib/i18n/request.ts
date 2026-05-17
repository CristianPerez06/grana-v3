import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { messages } from '@grana/i18n-messages'
import { defaultLocale, isLocale, localeCookieName } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(localeCookieName)?.value
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale

  return { locale, messages: messages[locale] }
})
