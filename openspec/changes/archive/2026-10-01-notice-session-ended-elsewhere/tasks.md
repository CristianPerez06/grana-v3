## 1. Comportamiento de la librería

- [x] 1.1 Agregar `apps/mobile/lib/__tests__/session-ending.test.ts`: cliente real de `@supabase/supabase-js` con `fetch` falso, `storage` en memoria y una sesión iniciada. Verifica que una respuesta de sesión inexistente de `/user` emite `SIGNED_OUT` y borra la sesión, y que un `fetch` que rechaza (sin conexión) deja la sesión y no emite nada. Verificar con `pnpm --filter mobile test`.

## 2. El chequeo

- [x] 2.1 Crear `apps/mobile/lib/session-watch.ts` con una función que reciba algo con forma de `AppState` y algo con forma de `supabase.auth` (`getUser`); con guarda contra doble registro. Pregunta al registrarse, pregunta y arranca un intervalo de 5 minutos en cada `active`, y frena el intervalo en cualquier otro estado. Sin importar `react-native`. Verificar con `pnpm typecheck:mobile`.
- [x] 2.2 Agregar `apps/mobile/lib/__tests__/session-watch.test.ts` con dobles y temporizadores falsos: pregunta al registrarse; `active` pregunta y repite cada 5 minutos; `background` frena las repeticiones; volver reinicia el intervalo sin preguntar dos veces seguidas; registrar dos veces no duplica. Verificar con `pnpm --filter mobile test`.
- [x] 2.3 En `apps/mobile/lib/supabase.ts`, registrar el chequeo una vez junto a `registerSessionRefresh`, con `AppState` y `supabase.auth`. Verificar con `pnpm typecheck:mobile` y `pnpm lint:mobile`.

## 3. Olvidar al cerrar sesión

- [x] 3.1 En `apps/mobile/app/_layout.tsx`, en la rama de `SIGNED_OUT`, vaciar la caché de React Query (`queryClient.clear()`) después de `router.replace('/(auth)/login')`. Verificar con `pnpm typecheck:mobile` y `pnpm lint:mobile`.

## 4. Verificar en el celular

- [x] 4.1 ~~Con la app en segundo plano, cambiar la contraseña desde la web y volver al celular: muestra el inicio de sesión. (Lo corre el usuario.)~~ No se corrió en el celular: decidido con el usuario, que da por buena la paridad con Pinpoint #242 (verificado allá en el simulador de iOS) y los tests de `session-ending.test.ts` y `session-watch.test.ts`.
- [x] 4.2 ~~Con la app abierta, cambiar la contraseña desde la web: el celular muestra el inicio de sesión en menos de 5 minutos sin tocar nada.~~ No se corrió en el celular: decidido con el usuario, que da por buena la paridad con Pinpoint #242 (verificado allá en el simulador de iOS) y los tests de `session-ending.test.ts` y `session-watch.test.ts`.
- [x] 4.3 ~~Sin conexión, cerrar y abrir la app: sigue con la sesión iniciada.~~ No se corrió en el celular: decidido con el usuario, que da por buena la paridad con Pinpoint #242 (verificado allá en el simulador de iOS) y los tests de `session-ending.test.ts` y `session-watch.test.ts`.
- [x] 4.4 ~~Cerrar sesión con el botón e iniciar sesión con otra cuenta sin cerrar la app: no aparece ningún dato de la cuenta anterior.~~ No se corrió en el celular: decidido con el usuario, que da por buena la paridad con Pinpoint #242 (verificado allá en el simulador de iOS) y los tests de `session-ending.test.ts` y `session-watch.test.ts`.

## 5. Cerrar

- [x] 5.1 `openspec validate notice-session-ended-elsewhere --strict` y `pnpm verify` pasan.
