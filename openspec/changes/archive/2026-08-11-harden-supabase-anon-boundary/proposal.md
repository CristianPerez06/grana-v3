# Proposal: harden-supabase-anon-boundary

## Why

Hoy el sistema está a salvo del ataque que motivó esta auditoría, pero lo está **por acumulación de aciertos, no por construcción**. Ninguna capa dice "el rol `anon` no puede tocar `public`": lo que hay son ~58 policies que, una por una, dereferencian `auth.uid()` y por eso evalúan falso sin sesión. La garantía es emergente, y una sola tabla futura sin `ENABLE ROW LEVEL SECURITY` la rompe entera.

El disparador fue un proyecto hermano al que le scrapearon la base: anon key pública (inlineada en el bundle por diseño) + una policy `SELECT USING (true)` para `anon` sobre la tabla principal. La auditoría de este repo (7-ago-2026) descartó esa clase de bug en las dos direcciones:

- **Repo**: `anon` no aparece en ninguna migración; las tres policies `using (true)` (`currencies`, `institutions`, `card_networks`) están correctamente acotadas `to authenticated`; la `service_role` key no existe en el código (solo se menciona como opcional en `SUPABASE_SETUP.md`); hay cero API routes y cero uso de Storage.
- **Producción**: sonda PostgREST sin sesión → las 20 tablas devuelven `200 []`, el RPC `get_movements_page` devuelve `[]`, y un INSERT anónimo devuelve `401`. Los policy counts vivos reconcilian **exactamente** con la historia de migraciones (`settlement: 1` y `household_invite: 2` son huellas que solo produce la 0043 aplicada). Drift cero.

Esto **no es respuesta a incidente**: nada es explotable hoy. Lo que sigue abierto son tres huecos estructurales y una contradicción spec↔implementación:

1. **`profiles` filtra columnas de más entre convivientes.** La policy `members read co-member profiles` (0024) otorga SELECT sobre la **fila entera** — incluyendo `email`, `financial_timezone`, `onboarding_completed_at` — cuando el comentario de su propia migración declara que la intención era `full_name`. Hoy el allowlist de columnas vive en el query layer (`packages/shared/src/queries.ts:63` y `:392`, ambos `.select('id, full_name')`). Un conviviente que abra devtools y corra `.select('*')` obtiene el email del otro. El impacto real es acotado (hogar de máximo 2, mediado por invitación, y suele ser tu pareja que ya conoce tu email); lo que importa es que la policy otorga **las columnas que `profiles` tenga en el futuro**. El día que alguien agregue `phone` o una preferencia con toggle de privacidad, se filtra sola sin que ninguna migración toque la policy.
2. **Los GRANT por defecto a `anon` nunca se revocaron.** No existe un solo `REVOKE ... ON TABLE ... FROM anon` en `supabase/migrations/`. RLS es el único punto de falla.
3. **Doce funciones son ejecutables por `anon`.** La auditoría reportó siete (las que nunca recibieron `revoke`), pero al aplicar la migración apareció que son doce: Supabase otorga `EXECUTE` a `anon` **directamente** vía default privilege, así que el `revoke ... from public` de 0048/0050/0051/0052 nunca le quitó el acceso a `anon` en esas otras cinco. El patrón que el repo daba por bueno estaba incompleto. Todas se autoguardan igual, así que no es explotable — pero es una brecha que solo aparece ejecutando, no leyendo el repo.
4. **La spec de `profiles` quedó desactualizada respecto de la 0024.** El requirement "Row Level Security sobre profiles" afirma que hay exactamente una policy de select restringida a `auth.uid() = id`, y su scenario "Un usuario autenticado no puede leer profiles de otros" espera **cero filas** cuando `U1` lee el profile de `U2`. Desde la 0024 eso es falso si comparten hogar. La spec describe un sistema que dejó de existir hace dos meses.

## What Changes

- **El allowlist de columnas de `profiles` baja a la base.** Se elimina la policy `members read co-member profiles` y se reemplaza por un RPC `SECURITY DEFINER` que devuelve exclusivamente `(id, full_name)`, con `revoke execute ... from public` + `grant execute ... to authenticated`. Los dos call sites de `@grana/shared` pasan a consumir el RPC. Después del cambio, `select('*')` sobre el profile de un conviviente devuelve **cero filas**: la garantía deja de depender de que cada query recuerde enumerar columnas.
- **El rol `anon` pierde los GRANT de tabla.** Migración con `revoke all on all tables in schema public from anon` + `alter default privileges in schema public revoke all on tables from anon`. Deja de existir el escenario "tabla nueva sin RLS = lectura pública": una tabla futura sin GRANT no es legible aunque a alguien se le olvide la policy. `authenticated` no se toca.
- **Las siete funciones sin `revoke` se alinean al patrón existente.** `get_movements_page`, `join_household_by_code`, `register_settlement`, `confirm_settlement`, `reverse_settlement`, `is_household_member`, `shares_household_with`. Sin cambio de comportamiento para usuarios con sesión.
- **`validate_schema.sql` gana una aserción permanente de cobertura RLS**: toda tabla de `public` SHALL tener RLS habilitado y al menos una policy. Como acá las migraciones se aplican a mano desde el SQL Editor del dashboard, esta aserción es la pieza de mayor valor duradero del change — es lo que detecta la tabla 21 sin depender de que alguien se acuerde de revisar.
- **La spec de `profiles` se pone al día con la realidad**: el requirement de RLS reconoce la lectura entre convivientes y la acota al allowlist de columnas, y el scenario que hoy miente se corrige.

Sin cambios de comportamiento visible para el usuario final. Ningún flujo de la app cambia.

## Capabilities

### New Capabilities

- `db-access-boundary`: la frontera de acceso a datos a nivel base. Qué puede hacer el rol `anon` (nada), qué privilegios de tabla y de función existen por rol, y la invariante de cobertura RLS que impide que una tabla nueva quede expuesta. Hoy esta superficie no está especificada en ningún lado: existe como propiedad emergente de ~58 policies, sin un solo requirement que la afirme.

### Modified Capabilities

- `profiles`:
  1. "Row Level Security sobre profiles" — deja de afirmar que solo existe la policy `auth.uid() = id`. Reconoce la lectura entre convivientes introducida por la 0024 y la acota: se lee vía RPC con allowlist explícito, no vía policy sobre la tabla. Se corrige el scenario "Un usuario autenticado no puede leer profiles de otros", que hoy contradice la implementación.
  2. **Nuevo requirement** "La lectura de profiles de convivientes expone solo las columnas del allowlist" — `email`, `financial_timezone` y `onboarding_completed_at` NO SHALL ser legibles por un conviviente, y la garantía SHALL vivir en la base, no en el `select` de cada query.
- `shared-data-access`: "El dominio Compartido expone sus lecturas desde un paquete `@grana/shared` agnóstico de plataforma" — las lecturas de profiles de convivientes pasan de `.from('profiles').select('id, full_name')` a la invocación del RPC. Es cambio de contrato de la capa de datos, no solo de implementación.

## Impact

- **Migración `0055`** (nueva): drop de la policy `members read co-member profiles`; RPC de lectura de profiles de convivientes con allowlist `(id, full_name)`; `REVOKE` de tablas + `ALTER DEFAULT PRIVILEGES` para `anon`; `revoke execute`/`grant execute` sobre las 7 funciones pendientes. Con self-check al final, como el resto de las migraciones del repo.
- `supabase/validate_schema.sql`: nueva sección de aserción de cobertura RLS sobre `public`.
- `packages/shared/src/queries.ts:63` y `:392`: pasan a consumir el RPC.
- `packages/supabase/src/types.ts`: regenerar tipos para incluir el RPC nuevo.
- **Riesgo de aplicación**: el `REVOKE` a `anon` es la única pieza con potencial de romper algo si existiera una lectura sin sesión que la auditoría no detectó. La sonda dice que no existe (las 20 tablas ya devuelven `[]`), así que revocar el GRANT no cambia ningún resultado observable — pero conviene re-correr la sonda después de aplicar, como verificación.
- **Sin impacto en**: flujos de UI, `apps/web`, `apps/mobile`, i18n. Ninguna pantalla cambia.
- **Fuera de alcance**: el gap de `protectedPrefixes` en `apps/web/lib/supabase/middleware.ts:73` (omite `/settings`, `/shared`, `/transactions`). No hay exposición de datos — `app/(app)/layout.tsx:9` llama `requireUserId()` para todo el grupo — y es un fix de ruteo web sin relación con la frontera de datos. Viaja en un change web futuro.
