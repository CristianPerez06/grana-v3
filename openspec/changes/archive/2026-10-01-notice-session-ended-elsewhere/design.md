## Context

Lo que hace hoy el código:

- `apps/mobile/app/_layout.tsx` escucha `onAuthStateChange` y, ante `SIGNED_OUT`, lleva a `(auth)/login`. No importa la causa: botón, sesión cerrada en otro lado o renovación rechazada.
- Nada le pregunta al servidor si la sesión sigue en pie cuando la app vuelve al frente o está quieta. Muchas lecturas llaman a `supabase.auth.getUser()`, pero solo cuando corren, y React Query tiene `refetchOnWindowFocus: false`.
- El `QueryClient` vive en el estado del root layout y nunca se vacía. Las query keys no llevan el id de la persona (`['dashboard', 'hero', …]`), así que una segunda cuenta en la misma sesión de la app arranca leyendo la caché de la primera.
- `lib/session-refresh.ts` (#173) ya ata la renovación del token a `AppState`, con dependencias inyectadas para poder probarlo en Node.

Comportamiento de `@supabase/auth-js` 2.105.4 del que depende el diseño, verificado en el código instalado:

- `getUser()` con sesión llama a `/user`. Si el servidor responde que la sesión no existe (`AuthSessionMissingError`), la librería borra la sesión y emite `SIGNED_OUT`.
- Una falla de red vuelve como `AuthRetryableFetchError`: la sesión queda intacta y no se emite nada.
- `getUser()` **sin** sesión devuelve el error sin llamar al servidor ni borrar nada ni emitir `SIGNED_OUT`. Por eso el chequeo no necesita saber si hay alguien con sesión iniciada: sin sesión no hace nada.

## Goals / Non-Goals

**Goals:** los chequeos del requirement nuevo de `auth`, y vaciar la caché de datos en cada `SIGNED_OUT`.

**Non-Goals:** un aviso empujado desde el servidor (Realtime o similar); el cartel de *por qué* se cerró la sesión; la web.

## Decisions

**1. El chequeo solo llama a `getUser()`; quien reacciona es el `SIGNED_OUT` que ya existe.** El root layout ya lleva al login ante cualquier `SIGNED_OUT`. Así el chequeo no lee la respuesta, y cubre también el caso en que la renovación del token, al volver tras más de una hora, descubre primero que la sesión ya no existe. Mismo razonamiento que Pinpoint #242. No hace falta una operación compartida en `packages/`: es una llamada, y en Grana no hay un paquete de auth.

**2. La regla vive en `lib/session-watch.ts`, con `AppState` y `auth` inyectados, y se registra una sola vez junto al cliente en `lib/supabase.ts`.** Igual que `session-refresh.ts`: el módulo no importa `react-native`, así que se prueba en la suite de mobile con dobles y los temporizadores falsos de vitest. Comportamiento:

- al registrarse (la app se abre) pregunta una vez;
- en cada `change` a `active` pregunta y arranca un intervalo de 5 minutos;
- en cualquier otro estado frena el intervalo.

El intervalo existe solo mientras la app está al frente, y se reinicia al volver, así que nunca pregunta dos veces seguidas. Pinpoint lo hizo como componente React porque además tenía que olvidar estado de React; acá no hace falta, y un módulo deja la regla junto a la de #173.

**3. La caché se vacía en el mismo `SIGNED_OUT` del root layout, después de navegar al login.** `queryClient.clear()` en esa rama. Va después de `router.replace` para que las pantallas de `(app)` ya no estén montadas y no relean en el vacío. Un solo lugar cubre el botón, la sesión cerrada en otro lado y la renovación rechazada.

**4. Un test fija el comportamiento de la librería: sin conexión no hay `SIGNED_OUT`.** Todo el diseño descansa en que la librería solo emite `SIGNED_OUT` ante una respuesta del servidor. `apps/mobile/lib/__tests__/session-ending.test.ts` crea un cliente real de `@supabase/supabase-js` con `fetch` falso y una sesión en memoria, y verifica: respuesta de sesión inexistente → `SIGNED_OUT` y sesión borrada; `fetch` que falla → sesión intacta y ningún evento. Va en la suite de mobile porque `packages/supabase` no tiene arnés de tests, y montar uno para un archivo no se justifica.

## Risks / Trade-offs

- [Una actualización de la librería empieza a emitir `SIGNED_OUT` ante una falla de red] → el test de la decisión 4 se cae.
- [Un pedido más cada 5 minutos] → unos cientos de bytes, solo con la app al frente y con sesión iniciada.
- [Vaciar la caché también la vacía cuando el mismo usuario vuelve a entrar] → la primera pantalla carga de cero en vez de mostrar datos viejos; es lo correcto tras un cierre de sesión.
