## Why

El alta mobile (`/transactions/new`) muestra la selección de **cuenta** y **categoría** como listas inline crudas de filas (`PickRow`): todas las cuentas y todas las categorías apiladas en la pantalla, empujando el resto del form hacia abajo. Es funcional pero pobre — no se parece al web (trigger compacto que abre un picker) y escala mal cuando hay muchas cuentas/categorías. El picker de cuenta aparece **3 veces** en el mismo form (origen, destino de transferencia, cuenta de acreditación del reintegro), así que la duplicación ya es real. Este change lo reemplaza por el patrón ya probado en mobile (`BankSelector` + `InstitutionPickerModal`): un **trigger-row** que abre un **`formSheet` modal** con la lista — extraído a un primitivo reusable `SelectField` + `SelectSheet` en `components/ui/`.

## What Changes

- **Primitivos nuevos** en `apps/mobile/components/ui/`: `SelectField` (trigger-row: valor seleccionado con avatar/primario/secundario, o placeholder, + `ChevronDown`) y `SelectSheet` (shell `formSheet` con header + `FlatList` + slots de header/footer y row-renderer), destilados del patrón `BankSelector`/`InstitutionPickerModal`. **Sin buscador** (web tampoco lo tiene).
- **Cuentas**: las 3 listas inline (`form.eligibleAccounts` origen, `form.otherAccounts` destino, `form.cashBankAccounts` acreditación del reintegro) pasan a un `AccountSelectField` sobre `SelectSheet`, con avatar por fila y el hint de tarjeta en las filas credit.
- **Categoría**: la lista inline con drill de subcategoría pasa a un `CategorySelectField` que maneja el drill **dentro del sheet**, espejo exacto del web: nivel de categorías (drillable → chevron; sin subcats → selecciona con ✓) → nivel drilleado (volver + "Toda la categoría" + subcategorías); el trigger muestra `Categoría › Subcategoría`.
- **Reimbursement target** (a cuenta / a resumen) pasa de `PickRow` a `Segmented`, retirando el `PickRow` local por completo.
- **i18n**: reusa las keys existentes (`drawer.whole_category`, `drawer.add_new_category`, `placeholders.category`); agrega sólo `placeholders.account` (es+en).

## Capabilities

### Modified Capabilities

- `transactions`: el requirement **"La app nativa expone la pantalla de alta de movimiento `/transactions/new`"** se ajusta — la selección de cuenta y categoría SHALL renderizarse con el picker `SelectField`+`SelectSheet` (trigger-row + `formSheet`), no como listas inline; la categoría drillea un nivel dentro del sheet a paridad web.

## Impact

- **Packages**: sin cambios. No toca `@grana/*`, ni el hook, ni los mutators — sólo presentación mobile.
- **Web**: sin cambios.
- **Mobile**: `apps/mobile/components/ui/SelectField.tsx` + `SelectSheet.tsx` (nuevos), `apps/mobile/components/transactions/MovementForm.tsx` (consumers + retiro de `PickRow`), `packages/i18n-messages` (una key). Sin deps nuevas.
- **Sin cambios de datos/API/RLS**.
- **Dependencias entre changes**: requiere `mobile-movement-form-credit` (mergeado). Independiente de B.2b y del change C.

### Fuera de scope

- **B.2b** (exchange, ajuste, recurrencia) — sus campos de cuenta usarán el mismo `SelectField` cuando aterricen, pero no se agregan acá.
- **Calculadora en money-fields** (web-only por ahora, `evaluateMoneyExpression` ya está en `@grana/validation`) → gap de paridad separado.
- **Buscador** en el sheet — web no lo tiene; no se agrega.
