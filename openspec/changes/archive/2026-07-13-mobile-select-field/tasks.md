# Tasks — mobile-select-field

## 1. Primitivos (Decisión 1)

- [x] 1.1 `apps/mobile/components/ui/SelectSheet.tsx`: shell `formSheet` (`Modal` + `KeyboardAvoidingView` no requerido sin search) con header (título + cerrar), slot `header` opcional (para el drill), `FlatList` con `renderRow(item, isSelected)`, y slot `footer` opcional. **Sin `TextInput` de búsqueda.** Mirror del shell de `InstitutionPickerModal` menos el buscador.
- [x] 1.2 `apps/mobile/components/ui/SelectField.tsx`: trigger-row `Pressable` (h-11, borde, `bg-card`) con `value` (ReactNode: avatar + primario + secundario) o `placeholder`, y `ChevronDown`. Prop `invalid?` para el borde de error. Mirror del trigger de `BankSelector`.

## 2. Account picker (Decisión 2)

- [x] 2.1 `AccountSelectField` (en `MovementForm.tsx` o co-ubicado): `SelectField` + `SelectSheet` sobre una lista de `MovementFormAccount`; fila = `AccountAvatar` + institución/nombre (secundario) + hint credit (`transactions.drawer.credit_hint`) + ✓ en la seleccionada.
- [x] 2.2 Reemplazar los 3 usos inline por `AccountSelectField`: origen (`form.eligibleAccounts` → `form.setAccountId`), destino transferencia (`form.otherAccounts` → `form.setDestinationAccountId`), acreditación del reintegro (`form.cashBankAccounts` → `form.setReimbursementAccountId`). Placeholder `transactions.placeholders.account`; título del sheet = label del campo.

## 3. Category picker (Decisión 3)

- [x] 3.1 `CategorySelectField`: `SelectField` (trigger `Categoría › Subcategoría`, subcat en muted; placeholder `placeholders.category`) + `SelectSheet` con estado de drill.
- [x] 3.2 Nivel 0: `form.transactionCategories`; con subcats → chevron que drillea; sin subcats → `form.pickCategory(id, '')` con ✓. (El footer "＋ agregar categoría" se descartó a pedido del usuario — el `SelectField`+`SelectSheet` no navega fuera del form.)
- [x] 3.3 Nivel 1 (drilleado): slot `header` con volver (‹ + nombre categoría), fila "`drawer.whole_category`" → `pickCategory(id, '')`, y subcategorías → `pickCategory(id, sub.id)` con ✓ en `form.subcategoryId`.
- [x] 3.4 Reemplazar la sección de categoría inline (lista + drill) por `CategorySelectField`.

## 4. Cleanup + i18n (Decisiones 4, 5)

- [x] 4.1 Reimbursement target: se mantiene como **radio vertical** (`RadioRow`), NO `Segmented` — los labels son frases largas que wrapean mal en un segmented de 2 opciones (ver design Decisión 4).
- [x] 4.2 `PickRow` reemplazado por `RadioRow` slim (sólo `label`/`selected`/`onPress`), usado únicamente por el target; se quitaron `secondary`/`hint`/`compact`.
- [x] 4.3 Agregar `transactions.placeholders.account` a es.json + en.json (paridad de keys). Verificar que las demás keys usadas ya existen.

## 5. Verificación

- [x] 5.1 Typecheck mobile en verde; lint en verde.
- [x] 5.2 Cero diffs en `packages/` (salvo la key i18n) y en `apps/web/`.
- [x] 5.3 Smoke en device: abrir cada picker de cuenta (origen, destino en transferencia, acreditación del reintegro) → elegir → el trigger refleja la selección · categoría: drill a subcategoría y "Toda la categoría" · trigger muestra `Cat › Sub` · reintegro target como radio vertical · alta simple y en cuotas siguen guardando.
