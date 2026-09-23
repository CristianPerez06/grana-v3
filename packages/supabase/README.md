# @grana/supabase

Slot de tipos de la base (`Database`) + factory `createClient`. Es la base tipada sobre la que cada app construye su propio cliente Supabase.

## Por qué este package existe

Las queries de Supabase **no** viven acá — viven en el `lib/` de cada app, porque cada plataforma arma su cliente distinto (SSR con cookies en web, AsyncStorage en mobile). Lo que sí se comparte es:

- El tipo `Database` generado del proyecto Supabase remoto, para que las queries de ambas apps estén tipadas contra el mismo esquema.
- Una factory mínima `createClient(url, anonKey, options)` que ya viene parametrizada con `Database`, así nadie re-tipea el cliente a mano.

## Qué exporta

| Export | Qué es |
|---|---|
| `createClient(url, anonKey, options?)` | Envuelve `@supabase/supabase-js` ya tipado con `Database`. Las apps le pasan su config y wrapping de auth. |
| `GranaSupabaseClient` | `SupabaseClient<Database>` — el tipo del cliente, para anotar funciones que reciben un client. |
| `Database` | Los tipos del esquema remoto, escritos a mano (ver Reglas). |

## Reglas

- **`src/types.ts` se mantiene A MANO.** El proyecto no usa la CLI de Supabase: no hay `supabase gen types`. Cuando una migración cambia el contrato público —una tabla, una columna, la firma de un RPC o la forma de lo que devuelve— la entrada se escribe copiando lo que dice el SQL aplicado, se compara contra él y se corren `pnpm typecheck` y `pnpm typecheck:mobile`. El typecheck sólo demuestra que el código coincide con este archivo; que este archivo coincida con el esquema remoto lo sostiene esa comparación, y nada más. Ver "Migrations are the schema truth" y "Supabase is online-only, and the CLI is not part of the loop" en `AGENTS.md`.
- **Sin queries ni server actions.** Eso es código de cada app.

## Cómo se consume

```ts
import { createClient, type GranaSupabaseClient } from '@grana/supabase'
// cada app envuelve este createClient con su manejo de auth/cookies
```
