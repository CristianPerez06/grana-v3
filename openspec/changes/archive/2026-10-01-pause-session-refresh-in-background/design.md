## Context

`apps/mobile/lib/supabase.ts` crea el cliente con `autoRefreshToken: true`. En `@supabase/auth-js` 2.105.4 (la versión instalada) eso arranca un temporizador que revisa la sesión cada 30 segundos y la renueva cerca de expirar. La librería pausa ese temporizador por su cuenta solo en un navegador, cuando la pestaña queda oculta; para React Native su documentación pide que la app llame a `startAutoRefresh()` / `stopAutoRefresh()` según su estado. En la app nadie lo hace.

Dos comportamientos de la librería en los que se apoya el spec, verificados en el código instalado: `startAutoRefresh()` corre un chequeo en el acto (no espera al primer intervalo), así que una sesión que expiró en segundo plano se renueva al volver; y una renovación que falla por falta de conexión es un error reintentable, que no borra la sesión y se reintenta en el chequeo siguiente.

Es el mismo cambio que Pinpoint hizo en su PR #248; acá se replica, con una diferencia en cómo se prueba.

## Goals / Non-Goals

**Goals:** atar la renovación de la sesión a que la app esté al frente, con el patrón que documenta la librería, y dejarlo cubierto por un test.

**Non-Goals:** la detección de sesión cerrada desde otro dispositivo (#169); la web; cuánto dura una sesión; el `focusManager` de React Query (`lib/focus-manager-setup.ts`), que sigue como está.

## Decisions

**Se registra una sola vez, junto al cliente.** La renovación es del cliente, no de una pantalla ni de si hay alguien con sesión iniciada, y la documentación de la librería pide registrarlo una única vez. `lib/supabase.ts` llama al registro inmediatamente después de crear el cliente, así vive lo mismo que él. Ponerlo en `focus-manager-setup.ts` mezclaría dos cosas que no se relacionan (cuándo React Query vuelve a leer y cuándo se renueva la sesión) y lo ataría a que el `QueryClientProvider` se monte.

**La regla vive en un módulo propio con sus dependencias inyectadas: `lib/session-refresh.ts`.** Exporta una función que recibe algo con la forma de `AppState` (`addEventListener('change', …)`) y algo con la forma de `supabase.auth` (`startAutoRefresh` / `stopAutoRefresh`), con una guarda para que un segundo llamado no registre otro listener (mismo patrón que `registerFocusManager`). `lib/supabase.ts` le pasa el `AppState` real y `supabase.auth`. El motivo es el test: la suite de mobile corre en Node y no puede importar `react-native` (se publica en Flow), así que un módulo que no lo importa se prueba con dobles que registran qué se llamó. Pinpoint lo dejó sin test; acá el checklist del issue pide uno y el costo es un archivo chico.

**Arranca en `active`, frena en cualquier otro estado — `inactive` incluido.** Es el patrón de la librería tal cual, y coincide con lo que ya hace `registerFocusManager` (`state === 'active'`). Frenar en `inactive` (centro de notificaciones, selector de apps en iOS) y retomar al volver cuesta un chequeo inmediato que no hace nada salvo que la sesión esté por expirar; no lee datos.

## Risks / Trade-offs

- [La app ya está al frente cuando se carga el módulo, así que no llega ningún evento `change` para ese primer estado] → `autoRefreshToken: true` se queda prendido: el cliente arranca su propio temporizador al crearse, como hoy; el listener solo gobierna las transiciones posteriores.
- [Una lectura que sale justo al volver compite con la renovación inmediata] → `getSession()` ya renueva una sesión vencida cuando se le pide y la librería serializa las renovaciones detrás de un único lock, así que la lectura espera el token nuevo en vez de usar el viejo.
- [El test prueba la regla con dobles, no la app real] → la verificación en el celular (volver después de una hora, volver sin señal) queda como tarea explícita.
