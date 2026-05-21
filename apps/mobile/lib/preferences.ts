// TODO(migrate-show-cents-to-db): hoy mobile lee `show_cents` desde
// expo-secure-store local; web lo lee desde una cookie. Las dos
// preferencias son independientes — togglear en web no se refleja en mobile.
// Cuando se haga el change que migra `show_cents` a una columna en `users`
// (o a una tabla `user_preferences`), este archivo pasa a leer del cliente
// Supabase compartido y la divergencia desaparece.

import * as SecureStore from 'expo-secure-store'

export const SHOW_CENTS_KEY = 'show_cents'

export async function getShowCents(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(SHOW_CENTS_KEY)
  return value === 'true'
}

export async function setShowCents(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(SHOW_CENTS_KEY, value ? 'true' : 'false')
}
