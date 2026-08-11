## 1. Migración 0055 — escribir el SQL

- [x] 1.1 Crear `supabase/migrations/0055_harden_anon_boundary.sql` con el header de contexto del repo (qué resuelve, por qué, referencia a `openspec/changes/harden-supabase-anon-boundary/`)
- [x] 1.2 Bloque A — profiles: `drop policy "members read co-member profiles" on public.profiles` + `drop function public.shares_household_with(uuid)` (único consumidor era esa policy, ver D2)
- [x] 1.3 Bloque A — crear el RPC `SECURITY DEFINER` que devuelve `table(id uuid, full_name text)` de los miembros del hogar del invocante, sin parámetros, con `set search_path = public` y `stable`. Resolver la pregunta abierta del design: incluir o no al propio usuario (propuesta: incluirlo y nombrarlo `get_household_member_profiles`)
- [x] 1.4 Bloque A — `revoke execute ... from public` + `grant execute ... to authenticated` sobre el RPC nuevo
- [x] 1.5 Bloque B — `revoke all on all tables in schema public from anon` + `alter default privileges in schema public revoke all on tables from anon`. NO tocar `authenticated`
- [x] 1.6 Bloque C — `revoke execute`/`grant execute to authenticated` sobre las 6 funciones pendientes: `get_movements_page`, `join_household_by_code`, `register_settlement`, `confirm_settlement`, `reverse_settlement`, `is_household_member` (`shares_household_with` ya no existe tras 1.2). Ojo D3: el `grant` a `authenticated` es obligatorio, no opcional — sin él, las 22 policies que llaman `is_household_member` fallan con `permission denied for function`
- [x] 1.7 Self-check final (patrón `DO $$ ... RAISE EXCEPTION` del repo) que verifique: policy vieja ausente, `shares_household_with` ausente, RPC nuevo presente y `SECURITY DEFINER`, `authenticated` con EXECUTE sobre las 7 funciones, y `pg_default_acl` sin default de `anon` para tablas de `public`
- [x] 1.8 Escribir el script de rollback inverso (ver Migration Plan del design) y dejarlo versionado junto a la migración o en su header como comentario

## 2. Aserción permanente de cobertura RLS

- [x] 2.1 Agregar a `supabase/validate_schema.sql` una sección que falle si alguna tabla de `public` tiene `relrowsecurity = false`, identificando la tabla por nombre
- [x] 2.2 Extender la aserción para que también falle si una tabla tiene RLS habilitado y cero filas en `pg_policies`
- [x] 2.3 Verificar que la aserción pasa — **solo después de aplicar `0055` (tarea 3.1)**. Los chequeos (3) y (4) de la sección 8.2C fallan a propósito contra el estado pre-migración, porque hoy `anon` todavía conserva los GRANT. Verificada junto con la tarea 3.5: `✓ 8.2C — cobertura RLS OK en las 20 tablas de public; anon sin privilegios`

## 3. Aplicación y verificación contra el proyecto remoto

*(los comandos contra la base los corre el usuario, no el agente)*

- [x] 3.1 Aplicar `0055` completa desde el SQL Editor del dashboard, en una sola transacción; confirmar que el self-check no aborta
- [x] 3.2 Re-correr la sonda anónima sobre las 20 tablas. **Esperado: `401`/permission denied, NO `200 []`** — ver D5 del design; el cambio de código es la señal de éxito, no una regresión
- [x] 3.3 Re-correr la sonda sobre los RPC (`get_movements_page` y el nuevo): esperado rechazo por privilegio de ejecución
- [ ] 3.4 Verificar que un usuario con sesión sigue leyendo todo lo suyo (dashboard, movimientos, cuentas, tarjetas) sin errores de `permission denied`
- [x] 3.5 Confirmar que la aserción nueva de la tarea 2 pasa. **Verificada corriendo el bloque 8.2C aislado (líneas 515–610), no el archivo completo**: `validate_schema.sql` aborta antes de llegar a 8.2C por una staleness pre-existente en 8.1D (espera 18 categorías de sistema; las migraciones producen 19 y la base tiene 20). Ver la nota de seguimiento al final

## 4. Capa de datos — consumir el RPC

- [x] 4.1 Regenerar `packages/supabase/src/types.ts` con `pnpm dlx supabase gen types typescript --project-id exhpnnaigjfcxcvmptxa` (requiere access token; lo corre el usuario). Recordar: el archivo es generado, no se edita a mano
- [x] 4.2 `packages/shared/src/queries.ts:63` (`getHousehold`): reemplazar `.from('profiles').select('id, full_name')` por la invocación del RPC
- [x] 4.3 `packages/shared/src/queries.ts:392` (`getPendingSettlements`): mismo reemplazo, manteniendo el `Map` por id que ya arma el código
- [x] 4.4 Verificar que no queda ninguna lectura directa de `profiles` para filas ajenas en `packages/` ni en `apps/` (las lecturas del propio profile con `auth.uid() = id` se quedan como están)
- [x] 4.5 `pnpm typecheck` y `pnpm lint` en verde

## 5. Specs y cierre

- [x] 5.1 Verificar que el delta de `profiles` refleja lo implementado, en particular que el scenario "Un usuario autenticado no puede leer profiles de otros" ahora sí describe el sistema real (antes contradecía a la 0024)
- [x] 5.2 Verificar que el delta de `shared-data-access` refleja el consumo vía RPC
- [ ] 5.3 Verificación manual del módulo Compartido con un hogar de 2 miembros: el nombre del conviviente sigue apareciendo en deuda, cuenta corriente y liquidaciones pendientes
- [ ] 5.4 Confirmar a mano que el email de un conviviente ya no es legible: con sesión de `U1`, un `select('*')` sobre el profile de `U2` devuelve cero filas
- [ ] 5.5 Dejar la rama lista (commit squasheado, título `type(scope): subject` sin body) y **parar** — el merge a main lo hace el usuario

## Seguimiento — fuera de alcance de este change

Dos cosas aparecieron al verificar y NO se tocan acá (no tienen relación con la
frontera de acceso a datos). Quedan anotadas para no perderse:

- **`validate_schema.sql` 8.1D está stale**: espera 18 categorías de sistema, pero las
  migraciones producen 19 (`0006` 17 + `0028` Cuidado personal + `0036`
  Financiero-ingresos). Nunca se actualizó cuando aterrizó la 0036. Hace que el archivo
  completo aborte antes de llegar a 8.2C.
- **La base tiene 20 categorías de sistema, una más de la que crea cualquier migración.**
  Una fila con `user_id IS NULL` solo puede venir de una sesión privilegiada (RLS fuerza
  `user_id = auth.uid()` para cualquier insert de la app), así que lo más probable es una
  inserción a mano desde el dashboard. Query para aislarla:

  ```sql
  select id, name, canonical_name, type, color, icon, created_at
    from categories
   where user_id is null
     and canonical_name not in (
       'comida','cuidado-personal','educacion','entretenimiento','financiero',
       'financiero-ingresos','freelance','hogar','impuestos','inversiones',
       'otros-gastos','otros-ingresos','reintegros-cashback','ropa-y-calzado',
       'salud','servicios','sueldo','tecnologia','transporte'
     );
  ```

  Resolver primero si esa fila es legítima (va a una migración de seed) o accidental
  (se borra), y recién ahí corregir el número esperado en 8.1D. Nota: la auditoría
  original verificó drift **estructural** (tablas, RLS, policies) contra `pg_class` y
  `pg_policies`; los datos de seed nunca se compararon. Este es drift de datos.
