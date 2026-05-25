// TODO(migrate-ui-prefs-to-db): hoy mobile guarda preferencias UI-only en
// expo-secure-store local (este archivo para `show_cents`, y
// `apps/mobile/lib/locale.ts` para `locale`); web persiste sus equivalentes
// en cookies (`show_cents`, `NEXT_LOCALE`). Las preferencias son
// independientes por plataforma — togglear en una no se refleja en la otra.
// Cuando se haga el change que migra estas preferencias a una columna en
// `users` (o a una tabla `user_preferences`), ambos clientes pasan a leer
// del cliente Supabase compartido y la divergencia desaparece.

import * as SecureStore from 'expo-secure-store'

export const SHOW_CENTS_KEY = 'show_cents'

export async function getShowCents(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(SHOW_CENTS_KEY)
  return value === 'true'
}

export async function setShowCents(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(SHOW_CENTS_KEY, value ? 'true' : 'false')
}
