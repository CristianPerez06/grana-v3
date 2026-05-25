// TODO(migrate-locale-to-db): igual que `show_cents` (ver TODO en
// `apps/mobile/lib/preferences.ts`), el locale activo hoy se guarda en
// `expo-secure-store` local y NO se sincroniza con la cookie `NEXT_LOCALE`
// de la web. Cuando se haga el change que migra preferencias UI a una
// columna en `users` (o tabla `user_preferences`), este archivo pasa a
// leer del cliente Supabase compartido y la divergencia desaparece.

import * as SecureStore from 'expo-secure-store'

export const LOCALE_KEY = 'locale'

export const locales = ['es', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'es'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value)

export async function getLocale(): Promise<Locale> {
  const value = await SecureStore.getItemAsync(LOCALE_KEY)
  return isLocale(value) ? value : defaultLocale
}

export async function setLocale(value: Locale): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, value)
}
