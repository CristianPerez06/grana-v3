## 1. Pausar y retomar la renovación

- [x] 1.1 Crear `apps/mobile/lib/session-refresh.ts` con una función que reciba un objeto con forma de `AppState` y otro con forma de `supabase.auth`, registre un único listener de `change` (con guarda contra doble registro) que llame a `startAutoRefresh()` en `active` y a `stopAutoRefresh()` en cualquier otro estado, sin importar `react-native`. Comentario que diga por qué (la librería solo lo hace sola en un navegador). Verificar con `pnpm typecheck:mobile`.
- [x] 1.2 En `apps/mobile/lib/supabase.ts`, llamar a esa función una vez, después de crear el cliente, con el `AppState` de `react-native` y `supabase.auth`; `autoRefreshToken: true` se queda. Verificar con `pnpm typecheck:mobile` y `pnpm lint:mobile`.
- [x] 1.3 Agregar `apps/mobile/lib/__tests__/session-refresh.test.ts` con dobles: `active` arranca la renovación; `background` e `inactive` la frenan; registrar dos veces deja un solo listener. Verificar que corre y pasa con `pnpm test`.

## 2. Verificar en el celular

- [x] 2.1 Iniciar sesión en el celular, mandar la app a segundo plano más de una hora y volver: sigue con la sesión iniciada y la pantalla carga sin error. (La corre el usuario; dejar los pasos.)
- [x] 2.2 Repetir 2.1 sin conexión al volver: sigue con la sesión iniciada; al volver la conexión la sesión se renueva sola, sin tocar nada.

## 3. Cerrar

- [x] 3.1 `openspec validate pause-session-refresh-in-background --strict` y `pnpm verify` pasan.
