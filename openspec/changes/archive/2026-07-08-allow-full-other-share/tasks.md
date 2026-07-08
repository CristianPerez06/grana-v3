## 1 · Base de datos (migración 0047)

- [x] 1.1 Crear `supabase/migrations/0047_shared_split_allow_zero.sql`: `alter table shared_expense_split drop constraint chk_split_percentage`, luego `add constraint chk_split_percentage check (percentage between 0 and 100)`.
- [x] 1.2 Regenerar tipos si aplica (`supabase gen types`) — el tipo de `percentage` no cambia (smallint), así que probablemente no haga falta.

## 2 · Validación

- [x] 2.1 `packages/validation/src/shared.ts`: `splitEntrySchema.percentage` de `.min(1)` a `.min(0)`. Verificar que el test `splits-sum-100` y `.min(2)` siguen cubriendo lo degenerado.
- [x] 2.2 Confirmar que `updateHouseholdConfigSchema.default_split` (mismo schema) no habilita un default 0/100 por UI (el editor lo clampa; ver 3.3).

## 3 · UI web — toggle dedicado (`apps/web/lib/transactions/components/movement-form.tsx`)

- [x] 3.1 En el bloque de split (`~1379-1415`), agregar el toggle "Lo pagué yo, pero es 100% de {nombre}" + subtexto "Te queda debiendo el total". Estado nuevo (ej. `fullyOtherShare`).
- [x] 3.2 Al activar → set split `{sharedMembers[0]: 0, sharedMembers[1]: 100}` y ocultar el input `%`; al desactivar → restaurar el editor libre con el valor previo (o el default del hogar). Asegurar que el submit arma los `splits` con 0/100.
- [x] 3.3 Dejar el editor de split **por defecto** del hogar (`default-split-edit-drawer.tsx:101`) SIN cambios (sigue `1..99`).
- [x] 3.4 Copy es/en en i18n (voz Grana). Reusar patrón de `shared.split.*`.
- [x] 3.5 Verificar el flujo de **edición**: cargar un gasto ya 0/100 debe reflejar el toggle activo; cambiar de/hacia 0/100 debe re-aplicar splits (`updateTransaction` → `applySharedSplits`).

## 4 · Mobile — handoff (NO implementamos)

- [ ] 4.1 Documentar para el tech lead: el contrato (validación + DB) ya habilita 0/100; falta el toggle equivalente en el form nativo. Dejar nota en el canal/handoff habitual.

## 5 · Verificación

- [x] 5.1 `pnpm typecheck` + `pnpm lint` verdes.
- [x] 5.2 `openspec validate allow-full-other-share`.
- [ ] 5.3 **QA en la app** (hogar de dos miembros):
  - Alta de gasto con toggle 100%-del-otro → tu cuenta baja el total; deuda = el otro te debe el total.
  - Tu "en qué se fue": el gasto NO aparece. El del otro: aparece completo (probar con categoría del sistema).
  - Listado de movimientos: `−$total` + `Tu parte: $0`.
  - Reintegro sobre ese gasto (si aplica): baja la deuda del otro.
  - Edición: pasar un 50/50 a 100%-del-otro y viceversa.

## 6 · Cierre

- [ ] 6.1 Archivar el change y sincronizar `openspec/specs/shared/spec.md` **en la branch, antes del merge**.
