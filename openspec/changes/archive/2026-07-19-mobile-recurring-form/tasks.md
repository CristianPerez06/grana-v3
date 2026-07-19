# Tasks — mobile-recurring-form (③.2)

## 1. Mutators mobile

- [x] 1.1 En `apps/mobile/lib/recurrences/mutators.ts`, agregar `createRecurrence(input: unknown, t)`: resolver auth, `getHousehold()` (de `lib/shared/queries`), mapear a `RecurrenceHousehold` (`{ id, members: members.map(m => ({ userId: m.userId })) }` o `null`), delegar en `createRecurrence` de `@grana/recurrences`, localizar el resultado.
- [x] 1.2 Agregar `updateRecurrence(id: string, patch: unknown, t)`: resolver auth, delegar en `updateRecurrence` del package, localizar.
- [x] 1.3 Ajustar la localización para forms: surface-ar `formError` del package cuando venga (fallback al error genérico de recurrencia). Sin field-level highlighting.
- [x] 1.4 Verificar los imports (`getHousehold`, tipos `RecurrenceHousehold`) y que no rompe los mutators existentes.

## 2. Create form — `RecurrenceForm`

- [x] 2.1 Crear `apps/mobile/components/recurrences/RecurrenceForm.tsx` que componga los primitivos existentes (`Segmented`, `SelectField`/`SelectSheet`, `MoneyAmountInput`, `Switch`, `DateField`, `Input`, `AccountAvatar`).
- [x] 2.2 Estado + campos: tipo, cuenta (con elegibilidad por tipo), moneda (cycle si 2 activas), monto, categoría/subcategoría (income/expense), cuenta destino (transfer), descripción, `start_date` (default hoy), frecuencia (preset + custom), `end_date` opcional tras Switch, `max_occurrences` opcional, compartir (gasto + hogar de 2) con split.
- [x] 2.3 Validación client-side (mirror del `handleSubmit` web): monto > 0; categoría requerida (income/expense); destino requerido y ≠ origen (transfer); fin ≥ inicio. Errores a nivel form.
- [x] 2.4 Armar el payload (spread condicional por tipo + `shared` template) y llamar a `mutators.createRecurrence`; en éxito invalidar (`invalidateAfterRecurrenceMutation`) y `router.back()` al hub.
- [x] 2.5 Reusar la elegibilidad de cuenta / cambio de moneda / construcción de split de `MovementForm` (helpers puros si aplica, sin nueva abstracción).

## 3. Create screen + entry

- [x] 3.1 Crear `apps/mobile/app/(app)/transactions/recurring/new.tsx`: cargar inputs (cuentas incl. crédito vía `getAccounts`, árbol de categorías, hogar) con `useQuery`, chrome (`PageHeader` + back) visible desde el primer paint, montar `<RecurrenceForm>` cuando la data está lista (mirror de `transactions/new.tsx`).
- [x] 3.2 En `recurring/index.tsx`, agregar un icon-button "+" en el header (`actions`) → `router.push('/transactions/recurring/new')`.

## 4. Edit form + entry

- [x] 4.1 Crear `apps/mobile/components/recurrences/RecurrenceEditForm.tsx`: form de 4 campos (monto, frecuencia [sólo presets], `end_date` opcional, descripción) sembrado desde la `RecurrenceDetail`; en éxito `updateRecurrence` → invalidar + cerrar.
- [x] 4.2 En `recurring/[id].tsx`, agregar un icon-button Editar (pencil) en el header y montar `<RecurrenceEditForm>` dentro de un `Drawer` (bottom sheet) con estado `editOpen`.
- [x] 4.3 Actualizar el comentario del docblock de `[id].tsx` (ya no es "never opens an edit form").
- [x] 4.4 Al guardar la edición, refetch/invalidar el detalle (`['recurrences','detail',id]`) y el hub.

## 5. i18n

- [x] 5.1 Verificar que las keys usadas existen en `@grana/i18n-messages` (`recurrences.create.*`, `recurrences.edit_title`, `recurrences.actions.save_changes`/`create`, `recurrences.labels.*`, `recurrences.custom_interval.*`). Agregar sólo las native-only faltantes (es + en) si aparece alguna.

## 6. Verificación

- [x] 6.1 `pnpm --filter mobile typecheck` y `lint` verdes (sólo el warning preexistente de gen-icons).
- [x] 6.2 `pnpm --filter web test` verde (no se toca web; sanity de que el package sigue intacto).
- [x] 6.3 `openspec validate mobile-recurring-form --strict`.
- [x] 6.4 Smoke en device: crear regla (income/expense/transfer, preset y custom, con/sin fin, compartida) → aparece en el hub y su primera instancia como pendiente en el feed; editar una regla (monto/frecuencia/fin/descripción) → el detalle refleja los cambios.
