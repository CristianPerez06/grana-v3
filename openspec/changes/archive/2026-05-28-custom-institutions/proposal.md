## Why

El catálogo de `institutions` está cerrado: hoy son 23 entidades pre-cargadas, inmutables para el usuario por RLS. Si el banco/billetera del usuario no está en el catálogo, no hay forma de crear una cuenta `type='bank'` que lo refleje — el form rechaza el submit por la constraint `chk_bank_has_institution`. Esto bloquea casos reales: fintechs no curadas, cooperativas, billeteras nuevas, instituciones del exterior para usuarios con cuentas duales, etc.

La feature levanta la restricción: permite al usuario crear su propia institución desde el dropdown del form de cuenta cuando su banco no aparece. La intención es que esa institución se comporte funcionalmente igual que una del catálogo (tiene nombre, color, tipo de ícono), de modo que el avatar de la cuenta (color + ícono heredados de la institución) siga funcionando sin código condicional.

## What Changes

- Se modela la institución custom como **fila en `institutions` con `user_id`** (Opción A). Catálogo = filas con `user_id IS NULL` (inmutable, como hoy). Custom = filas con `user_id = auth.uid()` (CRUD habilitado solo para su dueño vía RLS). El shape del dato (`{ id, name, slug, brand_color, icon_type, is_active }`) y el resolver de avatar NO cambian: el resto del producto trata custom y catálogo de forma uniforme. Razón: deja la API de datos intacta, abre la puerta a reusar custom en cards sin re-trabajar el modelo, y mantiene la separación cuenta/institución limpia. Detalles y alternativa B descartada en `design.md` §1.
- El dropdown de institución en `CreateAccountForm` y `EditAccountForm` SHALL exponer un ítem **"+ Agregar nueva institución…" siempre disponible al final de la lista**, y SHALL promocionarlo (CTA destacado, nombre pre-rellenado con la búsqueda) cuando la búsqueda actual devuelve 0 matches. Razón: el usuario que sabe que su banco no está lo descubre rápido, y el que está explorando no lo pierde de vista. (Variante C de `design.md` §3.)
- Al seleccionar ese ítem se abre un **sub-form inline** (no modal) que pide los campos mínimos: `name` (1–50, trimmed, único por usuario), `brand_color` (de una paleta cerrada), `icon_type` (`bank` o `wallet`). Al confirmar, la institución queda creada y seleccionada en el dropdown del form padre. Cancelar vuelve al dropdown sin persistir nada. Razón: mantiene el flow continuo y no requiere introducir un `Dialog` primitivo nuevo. (`design.md` §4.)
- El usuario SHALL poder usar la institución custom para crear o editar tantas cuentas como quiera. La institución es por-usuario; no se comparte entre usuarios.
- `is_active` en custom queda fijo en `true` (sin UI de desactivación, que no aporta hoy); `slug` se deriva automáticamente de `slugify(name)` para mantener shape uniforme con el catálogo, sin garantía de unicidad global — la unicidad real es por `(name, user_id)`. (`design.md` §2.)
- Las instituciones custom NO se editan ni borran en este change. Una vez creadas, se quedan. Si una queda huérfana (la cuenta que la usaba cambia de institución), permanece en DB invisible — la pantalla de settings que la gestione es follow-up. (`design.md` §5 y §6.)

### Out of scope (este change)

- **Form de tarjeta de crédito.** El entry point elegido es solo `CreateAccountForm`/`EditAccountForm`. Como `cards` también consume `institutions`, las custom van a aparecer automáticamente en el dropdown del form de tarjeta — pero la decisión de **exponerlas explícitamente** (con su propio "+ Agregar nueva" desde ahí) queda como follow-up.
- **Pantalla de gestión en `/settings`.** CRUD dedicado (ver, editar, borrar) queda como follow-up. En este change la institución custom se crea desde el dropdown y no se edita ni borra desde la UI.
- **Edición de instituciones custom existentes.** Crear-only en este change. La RLS permite UPDATE/DELETE para preparar el follow-up, pero la UI no lo expone.
- **Paridad mobile.** El cambio es solo web. La app Expo queda igual; un change posterior replica el flow con el mismo contrato de datos.

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva: extiende `schema-base` (institutions) y `accounts` (UI del picker). -->

### Modified Capabilities

- `schema-base`: se modifica la requirement "Instituciones financieras argentinas pre-cargadas" para describir la coexistencia de filas de catálogo (inmutables, sin propietario) y filas custom (propiedad del usuario, mutables por ese usuario). RLS y constraints se ajustan según la opción elegida.
- `accounts`: se modifica la requirement "Cada cuenta tiene un avatar visual" para clarificar que la herencia "en vivo" desde la institución vale igual para custom y catálogo, y se agrega scenario de creación de institución custom desde el form.

## Impact

- **Schema:**
  - Migración SQL: agregar `institutions.user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE`, índice por `user_id`, ajustar el `UNIQUE` actual a `UNIQUE (slug) WHERE user_id IS NULL` + `UNIQUE (name, user_id) WHERE user_id IS NOT NULL`. RLS rewrites: SELECT abierto a `user_id IS NULL OR user_id = auth.uid()`; INSERT/UPDATE/DELETE permitido solo `WHERE user_id = auth.uid()` (catálogo sigue inmutable). Trigger BEFORE INSERT que setea `slug = slugify(name)` y valida que `name` esté trimmed (1–50), `brand_color` matchee `^#[0-9a-fA-F]{6}$`, `icon_type IN ('bank','wallet')`.
  - Regenerar `packages/supabase/src/types.ts` con `supabase gen types typescript --project-id <id>`.
- **Código (solo web):**
  - `apps/web/lib/accounts/queries.ts`: `listInstitutions()` ya filtra por RLS; queda automáticamente con catálogo + custom del usuario. Orden: catálogo alfabético, custom alfabético al final, separados visualmente en el dropdown.
  - `apps/web/app/_actions/institutions.ts` (nuevo): action `createCustomInstitution(input)` que valida vía `@grana/validation` e inserta. Maneja error de duplicado por usuario.
  - `apps/web/app/(app)/accounts/new/_components/create-account-form.tsx` + `apps/web/app/(app)/accounts/[id]/edit/_components/edit-account-form.tsx`: agregar el sub-form inline en el dropdown.
  - `packages/validation`: schema `createCustomInstitutionInput` con set cerrado de colores e iconos.
  - `packages/i18n-messages`: nuevas claves (`accounts.customInstitution.*`).
- **Sin impacto:** mobile, dashboard, transactions, settings, ni cards (las custom aparecen en su dropdown porque consume la misma query, pero no se agrega UI de creación ahí).
