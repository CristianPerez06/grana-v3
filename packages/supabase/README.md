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
| `Database` | Tipos generados del esquema remoto. |

## Reglas

- **`src/types.ts` es generado, no editado a mano.** Se regenera con `supabase gen types typescript --project-id <id>` contra el proyecto remoto. Ver "Migrations are the schema truth" y "Supabase is online-only" en `AGENTS.md`.
- **Sin queries ni server actions.** Eso es código de cada app.

## Cómo se consume

```ts
import { createClient, type GranaSupabaseClient } from '@grana/supabase'
// cada app envuelve este createClient con su manejo de auth/cookies
```
