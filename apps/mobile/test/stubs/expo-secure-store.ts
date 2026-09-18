/**
 * `expo-secure-store` arrastra `react-native`, que se publica en Flow y no
 * parsea fuera de Metro. Los módulos puros que este arnés prueba lo tocan sólo
 * de refilón —`lib/locale.ts` lee de él el idioma guardado— así que se reemplaza
 * por un almacenamiento en memoria en vez de excluir del test todo lo que lo
 * importe indirectamente.
 *
 * Si algún día un test necesita probar la PERSISTENCIA, no es acá: eso se mira
 * en la app, no en Node.
 */
const store = new Map<string, string>()

export async function getItemAsync(key: string): Promise<string | null> {
  return store.get(key) ?? null
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key)
}
