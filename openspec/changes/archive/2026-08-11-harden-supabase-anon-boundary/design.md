## Context

La auditoría del 7-ago-2026 estableció que el sistema está a salvo hoy, verificado en las dos direcciones (repo + sonda PostgREST contra producción, con drift cero entre migraciones y policies vivas). Este change no arregla una brecha: convierte una garantía emergente en una estructural.

Restricciones del proyecto que condicionan el diseño:

- **Las migraciones se aplican a mano** desde el SQL Editor del dashboard. No hay CLI instalado, ni `supabase/config.toml`, ni pipeline de deploy. Todo lo que dependa de "acordarse de correr X" es frágil por construcción; lo que se pueda dejar como aserción ejecutable en `validate_schema.sql`, mejor.
- **Un solo proyecto Supabase** (`exhpnnaigjfcxcvmptxa`) compartido por `apps/web` y `apps/mobile`. No hay staging. Cualquier migración se aplica directo sobre datos reales de 3 usuarios.
- **`packages/supabase/src/types.ts` es generado**, no editable a mano (regla explícita en su README). Agregar un RPC obliga a regenerar.
- La anon key es del formato nuevo `sb_publishable_*`, que además bloquea la introspección del OpenAPI root (`401 "Secret API key required"`). Eso ya limita el reconocimiento previo a un scrape; no es algo que este change agregue, pero conviene no perderlo.

## Goals / Non-Goals

**Goals:**

- Que "el rol `anon` no puede leer `public`" sea cierto por ausencia de GRANT, no por la suma de ~58 policies que casualmente dereferencian `auth.uid()`.
- Que el allowlist de columnas de `profiles` viva en la base y no en el `select` de cada query.
- Que una tabla futura mal configurada falle una aserción en vez de pasar desapercibida.
- Cero cambio de comportamiento visible para el usuario con sesión.

**Non-Goals:**

- No es respuesta a incidente. Nada es explotable hoy; no hay urgencia ni necesidad de rotar keys.
- No se toca el rol `authenticated`. Sus privilegios quedan exactamente como están.
- No se rediseñan las policies existentes. Las ~58 policies actuales son correctas; se les agrega una red debajo, no se las reescribe.
- No se agrega `to authenticated` a las policies que hoy omiten la cláusula `TO`. Son seguras (todas dereferencian `auth.uid()`), y una vez revocado el GRANT a `anon` la cláusula pasa a ser redundante. Tocarlas sería un diff enorme de valor marginal.
- Fuera de alcance el gap de `protectedPrefixes` del middleware web (ver proposal).

## Decisions

### D1 — RPC con allowlist, no policy ni column-level GRANT ni vista

**Elegido:** eliminar la policy `members read co-member profiles` y exponer `get_co_member_profiles()` `SECURITY DEFINER` que devuelve `table(id uuid, full_name text)`, sin parámetros, resolviendo la convivencia con `auth.uid()` internamente.

Alternativas consideradas:

- **Column-level GRANT** (`grant select (id, full_name) on profiles to authenticated`): rechazado. El GRANT es por rol, no por fila, así que también recortaría la lectura del **propio** profile — y el usuario necesita leer su `email` y su `onboarding_completed_at`. Además PostgREST con `select=*` erroraría en vez de filtrar, rompiendo call sites legítimos.
- **Vista con columnas acotadas**: rechazado. Una vista pertenece a un rol privilegiado y evita RLS de la tabla subyacente salvo que se declare `security_invoker`. Introduciría exactamente la clase de objeto que la auditoría celebró no encontrar (el repo hoy tiene **cero** vistas). No vale gastar esa propiedad acá.
- **Parámetro `p_user_ids uuid[]`**: rechazado. Obliga al RPC a confiar en ids que manda el cliente y a re-validar convivencia por cada uno. Sin parámetros, el conjunto lo determina la base y no hay nada que validar.

### D2 — `shares_household_with` se elimina, no se revoca

Su único consumidor es la policy que este change elimina (verificado: las 4 ocurrencias en el repo están todas dentro de `0024`). Dejarla revocada sería conservar un oráculo booleano muerto. Se dropea junto con la policy.

`is_household_member` es distinta: la usan 22 policies vivas (0023, 0025, 0043). Se queda, con `revoke`/`grant` explícito.

### D3bis — `REVOKE ... FROM public` NO le saca el acceso a `anon`

*Descubierto al aplicar la migración: el self-check abortó con `anon conserva EXECUTE sobre public.get_household_member_profiles()` inmediatamente después de haberle revocado a `PUBLIC`.*

Supabase tiene un default privilege que otorga `EXECUTE` **directamente a `anon`** sobre cada función nueva de `public`. `anon` por lo tanto no depende de `PUBLIC`, y revocarle a `PUBLIC` lo deja intacto. Hay que revocarle a `anon` por separado.

Esto invalida una conclusión de la auditoría original: las cuatro funciones que 0048/0050/0051/0052 "ya revocaban correctamente" (`unshare_movement`, `revert_card_period_payment`, `get_owned_account_ids`, `get_account_balance_sums`) **nunca dejaron de ser ejecutables por `anon`** — el patrón establecido en el repo estaba incompleto desde el principio. El hallazgo 3 de la auditoría era por lo tanto más amplio de lo reportado: no eran 7 funciones sin revoke sino 12 funciones con `anon` ejecutable, 5 de ellas con un revoke que aparentaba cubrirlas.

Sigue sin ser explotable: las cinco se autoguardan igual que las otras siete (RLS con rol invocante, o `raise 'not_authenticated'`). Pero es exactamente el tipo de brecha que una lectura del repo no detecta y solo aparece al ejecutar.

Decisión: `revoke execute on all functions in schema public from anon` (blanket, cubre las 12 y cualquier otra), más el default privilege de `functions` revocado por rol igual que el de `tables`. El self-check verifica las 12 por firma.

### D3 — Revocar EXECUTE obliga a otorgarlo a `authenticated` en el mismo movimiento

Cuando una policy invoca una función, ésta se ejecuta con el rol del invocante. Si `authenticated` pierde EXECUTE sobre `is_household_member`, **toda** policy que la llama falla con `permission denied for function` — no devuelve cero filas, rompe la query. Por eso cada `revoke execute ... from public` va pareado con su `grant execute ... to authenticated` en la misma migración, y el self-check verifica el GRANT, no solo el REVOKE.

### D4 — Una sola migración `0055`, transaccional, con self-check

El repo ya usa este patrón (bloque `DO $$ ... RAISE EXCEPTION` al final de cada migración). Las cuatro piezas son interdependientes en un sentido: si el REVOKE a `anon` se aplica y el RPC no, el módulo Compartido pierde los nombres. Una sola transacción evita estados intermedios.

### D5 — La sonda va a cambiar de resultado, y eso es la señal de éxito

Hoy un GET anónimo devuelve `200 []` (RLS filtra todo). Después del REVOKE devolverá `401`/`permission denied` (el GRANT falta antes de que RLS se evalúe). **Esto no es una regresión** — es la diferencia entre "te dejo entrar y no hay nada" y "no te dejo entrar". Queda documentado acá porque re-correr la sonda post-aplicación y ver `401` en vez de `200 []` es fácil de leer al revés.

Efecto lateral menor y bienvenido: `200 []` confirma que la tabla existe; `401` no confirma nada.

### D6 — La aserción de cobertura RLS vive en `validate_schema.sql`, no en CI

CI no tiene acceso a la base (no hay CLI ni credenciales en el pipeline; ver el design de `2026-05-17-version-email-templates`, donde ya se decidió no meter la service_role key en CI). `validate_schema.sql` se corre a mano desde el SQL Editor, que es el mismo lugar donde se aplican las migraciones — el momento en que alguien crea una tabla es el momento en que está en esa pantalla.

## Risks / Trade-offs

- **El REVOKE a `anon` rompe una lectura sin sesión que la auditoría no vio** → La sonda cubrió las 20 tablas y todas devolvieron `[]`, o sea que ninguna ruta anónima obtiene datos hoy; revocar el GRANT no puede cambiar un resultado que ya era vacío. Además no hay API routes ni uso de Storage. Mitigación operativa: re-correr la sonda inmediatamente después de aplicar.
- **`ALTER DEFAULT PRIVILEGES` sin `FOR ROLE` no alcanza** → *Confirmado en el primer intento de aplicar la 0055: el self-check abortó con `pg_default_acl sigue otorgando tablas a anon`.* La suposición original (que Supabase setea los defaults solo `FOR ROLE postgres` y que por eso bastaba con `current_user`) es falsa: Supabase registra entradas bajo más de un rol. Mitigación implementada: el bloque B **enumera** `pg_default_acl` y emite un `ALTER DEFAULT PRIVILEGES FOR ROLE <rol>` por cada uno, capturando `insufficient_privilege` para los roles internos que no podemos tocar. El self-check aborta solo si el default de `current_user` — el rol que efectivamente crea las tablas de la app — sigue otorgando a `anon`; el resto se reporta con `NOTICE`, porque los defaults de un rol aplican únicamente a las tablas que **ese** rol crea. Que el self-check haya atrapado esto en vez de dejar pasar una migración a medias es exactamente para lo que estaba.
- **Regenerar tipos requiere CLI + access token, y el CLI no está instalado** → Se corre con `pnpm dlx` sin instalar nada permanente. El comando lo ejecuta el usuario (no lo corre el agente). Si los tipos no se regeneran, TypeScript no conoce el RPC nuevo y el build falla ruidosamente — no hay modo de que pase silencioso.
- **Trade-off aceptado: una llamada de red extra en el módulo Compartido.** `getHousehold` hoy hace `household_member` → `profiles` (2 queries); pasará a `household_member` → RPC (2 queries). Sin cambio de cardinalidad. `getPendingSettlements` igual.
- **Riesgo de aplicación sobre datos reales sin staging** → Las cuatro piezas son DDL de privilegios + una función nueva. Ninguna toca filas. El rollback es un script inverso simétrico, incluido en las tasks.

## Migration Plan

1. Aplicar `0055` completa desde el SQL Editor (una transacción; el self-check aborta si algo falta).
2. Re-correr la sonda anónima. Esperado: `401`/permission denied en las 20 tablas y en los RPC — **no** `200 []` (ver D5).
3. Regenerar `packages/supabase/src/types.ts` contra el proyecto remoto.
4. Actualizar los dos call sites de `@grana/shared`; `typecheck` + `lint`.
5. Verificar a mano el módulo Compartido con un hogar de 2 miembros: el nombre del conviviente sigue apareciendo.
6. Correr `validate_schema.sql` completo y confirmar que la aserción nueva pasa.

**Rollback:** script inverso — re-crear `shares_household_with` y la policy `members read co-member profiles`, `grant all on all tables in schema public to anon` + restaurar default privileges, dropear el RPC nuevo. Los `revoke execute` de D3 pueden quedarse (son inocuos y alineados con 0048/0050/0051/0052). No hay migración de datos que revertir.

## Open Questions

- ~~¿Conviene que el RPC devuelva también al propio usuario, o solo a los convivientes?~~ **Resuelto al implementar: incluye al invocante**, y el RPC se llama `get_household_member_profiles`. `getHousehold` necesita los nombres de todos los miembros, así que devolver solo a los otros lo obligaría a unir dos fuentes. La spec de `profiles` se ajustó para decirlo explícitamente.
- ¿Se revoca también sobre `sequences` y sobre el schema `public` mismo (`REVOKE USAGE`)? Revocar `USAGE ON SCHEMA public FROM anon` sería el corte más tajante, pero podría afectar el flujo de auth de PostgREST de formas no verificadas contra este proyecto. Propuesta: dejarlo fuera de este change y evaluarlo por separado si alguna vez se quiere endurecer más.
