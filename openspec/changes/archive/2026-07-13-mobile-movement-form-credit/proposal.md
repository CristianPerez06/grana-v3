## Why

El alta mobile (`/transactions/new`, change `mobile-movement-form`) dejó fuera de scope la **familia de tarjeta de crédito**: el picker sólo ofrece cuentas cash/bank, así que un consumo de tarjeta —el movimiento más frecuente de la app— todavía no se puede registrar desde el teléfono. Las ramas del hook (`isCredit`/`isInstallments`), los orquestadores (`registerCardPurchase`/`registerInstallments`), los mutators nativos y las keys i18n del dominio **ya existen y están bindeados** — quedaron inalcanzables a propósito. Este change los hace alcanzables: es un slice **casi puramente presentacional** (un data-swap en el picker + JSX aditiva en `MovementForm`), cero cambios a packages compartidos, al hook y a los mutators. Es la mitad B.2a del plan; exchange/ajuste/recurrencia van en B.2b.

## What Changes

- **Picker de cuentas: cash/bank → todas.** La pantalla pasa de `getCashAndBankAccounts` a `getAccounts(supabase, { today })` (ya isomórfico en `@grana/accounts`) e incluye el grupo `credit` en la proyección a `MovementFormAccount` — mirror exacto de la proyección del drawer-loader web: `type: 'credit'`, `balances: { ARS: 0, USD: 0 }` (off-ledger), avatar vía `resolveAccountAvatar` de `@grana/ui-contracts` (ya dep de mobile). En la tab Gasto, la fila credit muestra el hint `transactions.drawer.credit_hint`; el hook ya restringe credit a la tab Gasto (`eligibleFor`).
- **Consumo simple en tarjeta**: con una credit seleccionada, el submit ya rutea a `registerCardPurchase` (dispatcher del hook + mutator bindeado en B) — sólo se vuelve alcanzable.
- **UI de cuotas** (credit + ARS): chips preset `1·3·6·12` + stepper custom (2–60) + preview del monto por cuota (`Money.divide`, mirror del web); CTA dinámico `actions.register_installments` cuando `isInstallments`. Para USD, el hint `installments_options.ars_only` (cuotas sólo en ARS, regla del hook).
- **Bloque de reintegro** (tab Gasto, no-cuotas), **paridad completa con web**: toggle + monto estimado + auto-cálculo por %/tope (`applyReimbursementPercent`) + radio de destino *a cuenta / a resumen* (resumen sólo con credit) + picker de cuenta de acreditación (cuando aplica) + checkbox *ya lo recibí*. Todo estado/handlers ya vive en el hook.
- **i18n**: las keys del dominio (`transactions.reimbursement.*`, `installments_options.*`, `labels.installments`, `drawer.credit_hint`, `actions.register_installments`) **ya existen** en el catálogo compartido (las usa web). Sólo se agregan labels de pantalla si falta alguno.

## Capabilities

### New Capabilities
<!-- Ninguna: habilita en mobile flujos ya especificados (consumo de tarjeta, cuotas, reintegro declarado). -->

### Modified Capabilities
- `transactions`: el requirement **"La app nativa expone la pantalla de alta de movimiento `/transactions/new`"** se amplía — el picker SHALL incluir cuentas credit (tab Gasto), la pantalla SHALL ofrecer cuotas (credit+ARS, 2–60) con preview por cuota, y SHALL ofrecer la declaración de reintegro con paridad web (monto/%/tope/destino/acreditación/recibido-ya). El scenario "el picker ofrece sólo cash/bank" se invierte.

## Impact

- **Packages**: un solo cambio quirúrgico en `@grana/movement-form` descubierto en device: el submit deja de usar `useTransition` (async transitions + Suspense de expo-router = pantalla en blanco, expo/expo#37155) y pasa a un flag de pending explícito — web-neutral, ver design.md Decisión 2. El resto (`@grana/transactions-mutations`, `@grana/accounts`, `@grana/ui-contracts`) se consume tal cual.
- **Web**: sin cambios (ni actions, ni componentes, ni i18n de dominio).
- **Mobile**: `apps/mobile/app/(app)/transactions/new.tsx` (data swap + proyección credit) y `apps/mobile/components/transactions/MovementForm.tsx` (secciones cuotas + reintegro + hint credit). Sin deps nuevas.
- **Sin cambios de datos/API/RLS**: mismos orquestadores, mismos schemas, mismo RLS path.
- **Dependencias entre changes**: requiere `mobile-movement-form` (mergeado). Independiente de B.2b y del change C.

### Fuera de scope

- **Exchange y ajuste** (tabs) y **recurrencia** (toggle Repetir) → B.2b. Sus mutators ya están bindeados; falta la UI.
- **Edición** de movimientos (incl. madre de cuotas) → change C.
- **Guided tour / spotlight** del primer movimiento (web-only, `useGuidance`) → no se portea.
