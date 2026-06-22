## 1. Dependencias y helpers

- [x] 1.1 Verificar si `date-fns` ya está en el árbol de `apps/web`; agregar `react-day-picker` (y `date-fns` si falta) a `apps/web/package.json` e instalar
- [x] 1.2 Crear helpers ISO↔Date locales (parse `YYYY-MM-DD` → `Date` local, serialize `Date` → `YYYY-MM-DD` con padding manual, sin `toISOString()`); helper `todayISO()` basado en `getTodayAR()`
- [x] 1.3 Tests de borde de los helpers (día 1, último día de mes, cambio de mes, año bisiesto) — sin corrimiento por UTC

## 2. Primitivo DatePicker

- [x] 2.1 Crear `apps/web/components/ui/date-picker.tsx`: `Popover` (Radix) + `<DayPicker>` mes completo + botón "Hoy"; props `value`/`onChange`/`min`/`max`/`label`/`disabled`/`modal` + variante de trigger (`field` | `row`)
- [x] 2.2 Configurar locale `es` y `weekStartsOn` lunes; deshabilitar días fuera de `min`/`max`; "hoy" del calendario y del atajo vía `todayISO()`
- [x] 2.3 Texto "Hoy" desde i18n (key común `common.today` + `common.pick_date` en `@grana/i18n-messages`)
- [x] 2.4 Crear story de Storybook `date-picker.stories.tsx` (variantes field/row, con min/max, dentro de drawer simulado)

## 3. Barrido — tarjetas (vía DateField)

- [x] 3.1 Reescribir `DateField` en `apps/web/app/(app)/cards/_components/card-form-ui.tsx` como wrapper delgado sobre `DatePicker` variante `field` (sin cambiar su firma)
- [x] 3.2 Verificar `create-card-form.tsx` (close/due dates) abre el mes completo y conserva el look
- [x] 3.3 Verificar `[id]/_components/edit-card-form.tsx` (current/next close+due) idem
- [x] 3.4 Reemplazar inputs nativos en `pay-card-period-form.tsx` (fecha de pago + next close/due) por `DatePicker`
- [x] 3.5 Reemplazar inputs nativos en `[id]/periods/[periodId]/_components/edit-dates-sheet.tsx` (end/due) por `DatePicker`

## 4. Barrido — movimiento y recurrencias

- [x] 4.1 Reemplazar el popover de fecha intermedio (botón "Hoy" + input nativo) en `lib/transactions/components/movement-form.tsx` por `DatePicker` variante `row`, propagando `modal={isDrawer}` (incluye el "repeat until" del alta de recurrencia desde movimiento)
- [x] 4.2 Reemplazar el popover de fecha en `transactions/recurring/_components/create-recurrence-modal.tsx` (start date) por `DatePicker`; mantener `min` en end date
- [x] 4.3 Reemplazar input nativo de end date en `create-recurrence-modal.tsx` por `DatePicker` con `min={startDate}`
- [x] 4.4 Reemplazar input nativo de end date en `transactions/recurring/[id]/_components/recurrence-edit-drawer.tsx` por `DatePicker`

## 5. Barrido — bloques pendientes

- [x] 5.1 Reemplazar input de fecha en `lib/transactions/components/pending-reimbursements-block.tsx` (received date) por `DatePicker`
- [x] 5.2 Reemplazar el edit de fecha inline en `lib/recurrences/components/pending-recurrences-block.tsx` por `DatePicker`

## 6. Verificación y cierre

- [x] 6.1 Grep de control: no quedan `<input type="date">` en `apps/web`
- [x] 6.2 `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` (web) en verde
- [x] 6.3 Recorrido manual de las 10 pantallas: un click abre el mes, "Hoy" correcto, round-trip de fecha sin corrimiento, min/max respetados, comportamiento dentro del drawer (QA del usuario OK)
- [x] 6.4 Archivar el change en la branch (mover a `archive/`, sincronizar `openspec/specs/web-date-picker/spec.md`, `pnpm openspec:check` en verde) antes del merge
