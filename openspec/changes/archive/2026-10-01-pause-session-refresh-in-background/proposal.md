## Why

La app del celular mantiene viva la sesión con un temporizador que nunca se pausa. Cuando la app pasa a segundo plano nadie le avisa, así que si ese temporizador sigue corriendo, se congela o se dispara tarde queda librado a lo que hagan iOS y Android. La propia documentación de Supabase dice que, en una app nativa, es la app la que tiene que pausarlo y retomarlo. Hoy nadie notó un problema; esto cierra el hueco antes de que alguien vuelva al celular después de una hora y encuentre una lectura que falla o un pedido de iniciar sesión (#173, mismo caso que Pinpoint #241).

## What Changes

- El celular deja de renovar la sesión mientras la app no está al frente, y la renueva en el acto cuando vuelve.
- Quien vuelve después de más de una hora (la sesión dura una hora) sigue con la sesión iniciada y sus datos cargan normalmente.
- Volver sin señal no cierra la sesión: la renovación espera a que vuelva la conexión.
- No cambia: la web, cuánto dura una sesión, ni la detección de sesión cerrada desde otro dispositivo (#169, todavía abierto).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `auth`: *Login con email y password* suma qué significa mantener la sesión viva en el celular — se renueva solo con la app al frente, en el acto al volver, y nunca se cierra por falta de conexión.

## Impact

- `apps/mobile/lib/supabase.ts` — donde el celular crea su conexión con Supabase; ahí se registra, una sola vez, la pausa y la reanudación.
- Un módulo chico nuevo en `apps/mobile/lib/` con esa regla, para poder probarla sin un celular.
- Sin dependencias nuevas, sin cambios en la base, nada en `packages/` ni en la web.
