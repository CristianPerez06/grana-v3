## 0. Diseño aprobado

- [x] 0.1 Modelado: **Opción A** — filas en `institutions` con `user_id`. Ver `design.md` §1.
- [x] 0.2 Variantes menores cerradas: §2 (`is_active=true` fijo, `slug=slugify(name)` derivado, unicidad por `(name, user_id)`), §3 (variante C — ítem siempre presente, promocionado cuando matches=0), §4 (sub-form inline), §5 (lifecycle no-op), §6 (crear-only, sin UI de edit/delete).

## 1. Schema y RLS (Supabase)

- [x] 1.1 Migración SQL en `supabase/migrations/NNNN_custom_institutions.sql`: `ALTER TABLE institutions ADD COLUMN user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE`, índice por `user_id`, ajuste de `UNIQUE` constraints (ver `design.md` §1 opción A).
- [x] 1.2 Reescribir las RLS policies de `institutions` para mantener el catálogo inmutable (`SELECT` abierto a authenticated, `INSERT/UPDATE/DELETE` rechazado cuando `user_id IS NULL`) y abrir CRUD para `WHERE user_id = auth.uid()`.
- [x] 1.3 Trigger / check de validación: `name` 1–50 trimmed, `brand_color` en formato `#RRGGBB`, `icon_type IN ('bank','wallet')`, `slug` derivado de `name` con `slugify` (puede ser un trigger BEFORE INSERT).
- [x] 1.4 Aplicar la migración en el proyecto online de Supabase (pegar el SQL en el SQL Editor del dashboard) y verificar con queries SELECT.
- [ ] 1.5 Regenerar `packages/supabase/src/types.ts` con `supabase gen types typescript --project-id <id>`. *(El archivo quedó parcheado a mano con el shape correcto del nuevo `user_id`; el regen real es follow-up — la próxima vez que cambie el schema se regenera completo y se sobreescribe el parche.)*

## 2. Tests del policy

> Los tests "SQL Editor" originalmente planeados resultaron inválidos: el SQL Editor de Supabase corre como rol `postgres` (superusuario) y bypassea RLS, por lo que el INSERT con `auth.uid()` NULL no fue evaluado contra las policies. Los tests reales de RLS se hacen desde el navegador con dos usuarios distintos.

- [x] 2.1 Login con usuario A, crear institución custom, verificar que aparece en su dropdown. *(Confirmado en el smoke test 6.2.)*
- [x] 2.2 Logout, login con usuario B, ir a `/accounts/new` → tipo Bancaria → confirmar que la custom del usuario A NO aparece en el dropdown ni al buscar por nombre. *(Verificado por el usuario: la custom "Mariposa" del usuario A no aparece para el usuario B.)*
- [ ] 2.3 (Opcional) Desde la consola del navegador como B, intentar `supabase.from('institutions').update(...)` sobre la custom del usuario A → debe fallar por RLS. *(No corrido; las policies para INSERT/UPDATE/DELETE están escritas con `using/with check (user_id = auth.uid())` y la validación de SELECT pasó, lo que da alta confianza pero no es una prueba directa de las write policies. Follow-up si se quiere paranoia.)*

## 3. Validación + Action

- [x] 3.1 `packages/validation/src/`: schema `createCustomInstitutionInput` (`name`, `brand_color`, `icon_type`). Incluir lista cerrada de colores e iconos en helpers.
- [x] 3.2 `apps/web/app/_actions/accounts.ts` (o nuevo archivo `institutions.ts`): action `createCustomInstitution(input)` que valida, inserta, retorna la institución creada. Manejar errores (duplicate name por usuario).

## 4. UI — dropdown con sub-form inline

- [x] 4.1 `apps/web/lib/accounts/queries.ts`: `listInstitutions()` debe devolver catálogo + custom del usuario, ordenado (catálogo alfabético, custom alfabético al final).
- [x] 4.2 `apps/web/app/(app)/accounts/new/_components/create-account-form.tsx`: agregar ítem "+ Agregar nueva institución…" siguiendo variante elegida en §3 del design. Al click, ocultar lista y mostrar sub-form inline con campos name, color, icon_type (usar los componentes existentes o uno nuevo `CustomInstitutionInlineForm`).
- [x] 4.3 Confirmar → llamar action, recibir `Institution`, seleccionarla en el dropdown del form padre, cerrar el sub-form.
- [x] 4.4 Cancelar → cerrar el sub-form, volver al dropdown sin tocar nada.
- [x] 4.5 Replicar en `apps/web/app/(app)/accounts/[id]/edit/_components/edit-account-form.tsx`.

## 5. i18n

- [x] 5.1 Agregar claves `accounts.customInstitution.add`, `customInstitution.title_inline`, `customInstitution.name`, `customInstitution.color`, `customInstitution.icon_type`, `customInstitution.icon_bank`, `customInstitution.icon_wallet`, `customInstitution.create`, `customInstitution.cancel`, `customInstitution.errors.*` en `packages/i18n-messages/src/{es,en}.json`.

## 6. Verificación

- [x] 6.1 `pnpm lint` y `pnpm build` en web pasan.
- [x] 6.2 Smoke test runtime: crear cuenta bancaria con institución custom, ver la cuenta listada con avatar correcto (color de la custom + ícono).
- [x] 6.3 Editar la cuenta y cambiarle la institución a una del catálogo → avatar cambia en vivo.
- [ ] 6.4 Crear segunda cuenta apuntada a la misma institución custom → comparten avatar. *(No corrido explícitamente; el resolver no diferencia origen así que sigue garantizado por construcción.)*
- [x] 6.5 Logout / login con otro usuario → no ve las custom del primero. *(Verificado por el usuario contra el deploy actual.)*

## 7. Cierre OpenSpec

- [x] 7.1 Archivar el change: mover a `openspec/changes/archive/YYYY-MM-DD-custom-institutions/`, integrar deltas a `openspec/specs/schema-base/spec.md` y `openspec/specs/accounts/spec.md`, completar el `Purpose` de cualquier capability nueva, y `pnpm openspec:check` en verde antes del merge.
- [x] 7.2 Follow-ups documentados como changes nuevos en backlog: "custom-institutions-en-cards", "custom-institutions-settings-crud", "custom-institutions-mobile".
