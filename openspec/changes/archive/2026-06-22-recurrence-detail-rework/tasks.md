## 1. Vista detail read-only

- [x] 1.1 Crear el detail component read-only (`recurring/[id]/_components/recurrence-detail.tsx`) que recibe `rule: RecurrenceDetail` y renderiza el resumen: monto protagonista + tipo, y filas de frecuencia, cuenta (o cuenta → destino en transfer), categoría cuando aplique, próxima fecha y end-date cuando exista. Reusar `recurrences.*` para labels.
- [x] 1.2 Decidir filas locales vs reuso de `TxDetailRow`/`TxDetailGroup` como primitivos puros (design Decisión 4); implementar lo que el diff real justifique sin acoplar a `FinancialMovement`.

## 2. Header actions (patrón A1)

- [x] 2.1 Crear las header actions (`recurrence-actions.tsx`): tres icon-buttons arriba a la derecha — ✏️ Editar, ⏸️/▶️ Pausar-Reactivar (toggle según `rule.status`), 🗑️ Eliminar. Editar dispara el callback que abre el drawer; pausar/reactivar llaman `pauseRecurrence`/`resumeRecurrence` + `router.refresh()`.
- [x] 2.2 Reemplazar el `confirm()` nativo por un Radix `AlertDialog` (clonado de `TxActionsMenu`) con copy contextual de recurrencia; al confirmar, `deleteRecurrence` + `router.push('/transactions/recurring')`.

## 3. Edit drawer

- [x] 3.1 Crear el edit drawer (`recurrence-edit-drawer.tsx`) montando `components/ui/drawer` con un form reducido de 4 campos (amount/frequency/end_date/description) que llama `updateRecurrence`; mover la lógica de save (parse de monto, validación, error/pending) desde `recurrence-detail-form.tsx`.
- [x] 3.2 Al guardar con éxito: cerrar el drawer + `router.refresh()`. No exponer pickers de cuenta/categoría/tipo.

## 4. Cableado y limpieza

- [x] 4.1 En `recurring/[id]/page.tsx`, reemplazar `<RecurrenceDetailForm rule>` por el detail read-only + header actions + edit drawer; mantener `<RecurrenceInstancesList>` debajo. Evaluar si el `<PageHeader>` actual sigue o si el título/monto se mueve al detail (alinear con la referencia).
- [x] 4.2 Borrar `recurring/[id]/_components/recurrence-detail-form.tsx` (su lógica quedó repartida entre drawer y header actions); confirmar por grep que no queda ningún import.

## 5. Spec y verificación

- [x] 5.1 Confirmar que el delta ADDED quedó en el spec `transactions` (requirement de detalle de recurrencia con sus 5 scenarios).
- [x] 5.2 i18n: agregar solo las claves faltantes (labels read-only, copy del AlertDialog); reusar `recurrences.*` existentes.
- [x] 5.3 `pnpm lint` + `pnpm typecheck` limpios.
- [x] 5.4 Verificación manual: la pantalla abre read-only; Editar abre el drawer (4 campos, sin cuenta/categoría/tipo) y guarda; Pausar/Reactivar togglea; Eliminar pide diálogo y vuelve a la lista; `RecurrenceInstancesList` intacta debajo.
