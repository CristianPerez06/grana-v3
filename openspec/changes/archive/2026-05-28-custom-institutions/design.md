## Context

Hoy `institutions` es un catálogo cerrado:

- Tabla `institutions(id, name, slug UNIQUE, brand_color, icon_type, is_active)` pre-cargada con 23 entidades del mercado argentino.
- RLS: SELECT abierto a authenticated; INSERT/UPDATE/DELETE rechazado siempre (las del catálogo son inmutables).
- `accounts.institution_id` referencia esta tabla. `chk_bank_has_institution` exige NOT NULL para `type='bank'`. `chk_cash_no_institution` exige NULL para `type='cash'`.
- El avatar de una cuenta bank deriva en vivo de su institución (`brand_color` → color del avatar; `icon_type` → `landmark` o `wallet`). Cuando `accounts.color_key`/`icon_key` están seteados, los overrides ganan (escenario "Override explícito queda fijo" en `accounts/spec.md`).

El alcance de este change (definido en `proposal.md`): el usuario debe poder crear su propia institución desde el dropdown del form de cuenta. Las custom NO se ofrecen desde cards en este change.

El **modelo de datos** está abierto. Esta sección documenta las dos alternativas concretas; la decisión se toma antes de empezar implementación (las tareas en `tasks.md` quedan ancladas a la opción elegida).

## Goals / Non-Goals

**Goals:**
- Que una cuenta `type='bank'` apuntada a una institución custom funcione **idéntico** a una apuntada al catálogo: avatar derivado, listas, header, dashboard. Cero código condicional `if (institution.isCustom)` en la UI.
- Una sola action de creación, validación bien definida, RLS estricta.
- Que el avatar herede color e icon_type de la institución custom igual que del catálogo.

**Non-Goals:**
- CRUD de instituciones custom desde una pantalla de settings dedicada — follow-up.
- Reusar instituciones custom en cards — follow-up; depende de la opción de modelado (opción A lo da gratis, opción B lo bloquea).
- Compartir instituciones custom entre usuarios — fuera de alcance.
- Migrar instituciones del catálogo "personalizables" — el catálogo sigue inmutable.

## Decisions

Las 6 decisiones que necesitaba este change quedan abajo cerradas. Para cada una se conserva la alternativa descartada y la razón, de modo que un futuro lector entienda no solo lo que decidimos sino lo que evaluamos y por qué no fue.

### 1. Modelo de datos: Opción A — filas en `institutions` con `user_id`

**Decisión:** Opción A.

- `institutions` gana columna `user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
- Catálogo = filas con `user_id IS NULL` (sigue siendo inmutable; RLS bloquea write).
- Custom = filas con `user_id = auth.uid()` (RLS abre `SELECT/INSERT/UPDATE/DELETE` solo para esas filas).
- El `slug` puede dejar de ser globalmente único (`UNIQUE (slug, user_id)` con `user_id IS NULL` como un valor más, o `UNIQUE (slug)` solo cuando `user_id IS NULL` y libre para custom). Decisión menor — preferencia: relajar a `UNIQUE (slug) WHERE user_id IS NULL` + `UNIQUE (name, user_id) WHERE user_id IS NOT NULL` para no chocar y mantener UX de nombre único por usuario.
- `accounts.institution_id` no cambia: sigue referenciando `institutions.id`.
- El avatar resolver no cambia: el `Institution` que recibe ya trae `brand_color` y `icon_type`, sin importar el origen.
- El catálogo de instituciones que la UI muestra es la unión: `WHERE user_id IS NULL OR user_id = auth.uid()`, ordenado por catálogo primero y custom después (o alfabético).

**Pros**
- La forma del dato es la misma: `Institution` sigue siendo `{ id, name, slug, brand_color, icon_type, is_active }`. El resto del producto no se entera.
- Las custom se pueden reusar en cards apenas se decida ampliar el entry point (sin más cambios de schema).
- Limpieza simple: `ON DELETE CASCADE` desde `auth.users` borra las custom del usuario al borrar la cuenta.
- Avatar resolver, queries y types: sin cambios estructurales.

**Cons**
- Migración real (alter column + RLS rewrites + trigger de validación). Un poco más de SQL.
- Riesgo bajo de "ensuciar" la tabla del catálogo si la RLS de SELECT del catálogo se afloja por error → mitigación: tests SQL del policy.

#### Opción B descartada — Campos override en `accounts`

Consistía en agregar `institution_name_override`, `institution_color`, `institution_icon_type` a `accounts`, dejar `institution_id` nullable también para `type='bank'`, y leer del override cuando es NULL. Más simple en SQL pero rechazada por:

- Cada cuenta lleva su copia de la institución: dos cuentas en el mismo banco custom son dos islas independientes, cambiar el color en una no afecta a la otra → el producto pierde coherencia.
- El avatar resolver y los types se ramifican (`account.institution ?? buildVirtualInstitution(account)` por todos lados): header de detalle, lista, dashboard hero, breakdown por banco — todo cambia.
- Cards no puede consumir esta institución (no hay `institution_id`) → bloquea el follow-up natural.
- Mezcla concerns: `accounts` termina con datos que no son de la cuenta.

A es marginalmente más SQL pero deja el resto del codebase intacto. Gana A.

### 2. `is_active` siempre true; `slug` derivado, no único cross-user

**Decisión:**

- `is_active = true` fijo para custom; no se expone control en UI. No hay administrador del lado del usuario que justifique desactivar/reactivar; si en el futuro la pantalla de settings necesita "soft delete" se reactiva la columna.
- `slug = slugify(name)` se computa en un trigger BEFORE INSERT, solo para mantener el shape uniforme con el catálogo. La unicidad real es por **`(name, user_id)`**. Constraints:
  - `UNIQUE (slug) WHERE user_id IS NULL` — el catálogo conserva su slug global único como hoy.
  - `UNIQUE (name, user_id) WHERE user_id IS NOT NULL` — el usuario no puede crear dos custom con el mismo nombre.

Razón: `id` ya es la key estable de cualquier custom; obligar slugs globalmente únicos solo agregaría reglas de colisión arbitrarias entre usuarios sin valor de producto.

### 3. UX del dropdown: ítem siempre presente, promocionado cuando no hay matches

**Decisión:** Variante C — el ítem "+ Agregar nueva institución…" SHALL aparecer siempre al final del dropdown, separado por una línea horizontal. Cuando la búsqueda devuelve 0 matches, el ítem SHALL renderizarse con CTA destacado y el `name` del sub-form SHALL pre-rellenarse con el texto buscado.

Alternativas: "solo al final" (el usuario explorando lo encuentra pero el que ya sabe que no está tiene que llegar al final), "solo cuando matches=0" (el usuario que tipea mal su búsqueda y obtiene matches parciales pierde el atajo). La variante C cubre ambos casos sin obstruir el flow.

### 4. Sub-form inline (no modal)

**Decisión:** Inline. Al click en el ítem "+ Agregar nueva institución…", el dropdown se reemplaza por un mini-form en el mismo lugar (`name` + `brand_color` + `icon_type` + botones `Crear`/`Cancelar`). Confirmar → cierra el sub-form, selecciona la institución recién creada en el form padre. Cancelar → vuelve al dropdown sin tocar nada.

Razón: mantiene la atención sobre el form padre, no requiere introducir un primitivo `Dialog` nuevo en `components/ui/`, y el costo visual (un par de campos extra) es chico. Un modal sería más espacio pero rompe el flow y agrega superficie.

### 5. Lifecycle: no-op (sin cleanup automático ni soft delete)

**Decisión:** Las instituciones custom no se borran automáticamente cuando dejan de tener cuentas que las referencien. Quedan en DB invisibles para la UI actual (no hay pantalla que las liste). El follow-up de `/settings` resuelve esto: ahí va el listado, la edición y el borrado manual.

Alternativas descartadas:
- **Cleanup automático al editar `institution_id`:** silencioso, pero si el usuario tenía intención de reusarla en otra cuenta nueva, se la borramos sin avisar.
- **Soft delete (`is_active = false`):** agrega complejidad de filtrado en queries sin beneficio inmediato.

No-op es el comportamiento más reversible y predecible.

### 6. Crear-only en este change; sin edición ni borrado desde UI

**Decisión:** La UI de este change permite crear instituciones custom. **No** se exponen UI de editar (cambiar nombre/color/icono) ni borrar. La RLS sí habilita UPDATE/DELETE para preparar el follow-up de `/settings`, pero ningún componente las invoca.

Razón: edición y borrado pertenecen a una pantalla dedicada de gestión que va a tener su propio change. Mezclarlo acá inflaría el scope y la superficie de pruebas.

## Risks / Trade-offs

- **RLS mal escrita** podría exponer custom de un usuario a otro o permitir UPDATE de filas del catálogo → Mitigación: tests SQL del policy en el SQL Editor de Supabase (insertar como user A, leer como user B; intentar UPDATE de fila con `user_id IS NULL`). Tasks 2.1–2.3 cubren esto.
- **Sub-form inline puede romper el grid del form padre** en mobile breakpoint → Mitigación: verificación visual en `sm` y bajo `sm` antes de archivar.
- **Nombres custom colisionando con el catálogo** ("Banco Galicia" como custom cuando ya existe en el catálogo): no es problema técnico (ids distintos) pero confunde al usuario. Mitigación: el CTA "+ Agregar nueva" se promociona solo cuando no hay matches; la búsqueda devuelve catálogo + custom mezclados.
- **Instituciones custom huérfanas en DB** (decisión 5: no-op) son data muerta hasta que se construya la pantalla de settings. Riesgo bajo: invisible para el usuario, irrecuperable desde la UI actual. La pantalla de gestión va a tener que mostrarlas y permitir cleanup manual.

## Migration Plan

1. Implementar migración + RLS + trigger (online en Supabase dashboard, pegar SQL desde `supabase/migrations/`).
2. Regenerar `packages/supabase/src/types.ts`.
3. Tests SQL del policy (tasks §2).
4. Action `createCustomInstitution` + schema de validación en `@grana/validation`.
5. UI: sub-form inline en el dropdown, en create y edit account forms; i18n keys.
6. Verificación visual: crear cuenta con custom, verificar avatar, editar y repuntar a catálogo, verificar avatar cambia en vivo; segundo usuario no ve custom del primero.
7. Archivar el change (integrar deltas a `openspec/specs/schema-base/spec.md` y `openspec/specs/accounts/spec.md`); `pnpm openspec:check` en verde.
8. Rollback: drop column `institutions.user_id` con CASCADE, recrear policy original. Las cuentas que apuntaran a instituciones custom quedarían con `institution_id` huérfano → habría que migrarlas a NULL o a una institución del catálogo antes del rollback; documentar en el plan de rollback del runbook al implementar.
