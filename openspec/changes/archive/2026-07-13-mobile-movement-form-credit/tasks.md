# Tasks — mobile-movement-form-credit

## 1. Picker: incluir cuentas credit (Decisión 1)

- [x] 1.1 En `apps/mobile/app/(app)/transactions/new.tsx`, reemplazar `useAccountsList` por una query propia sobre `getAccounts(supabase, { today: getTodayAR() })` con query key propio del form (no pisar `accountKeys.list`).
- [x] 1.2 Ampliar la proyección a `MovementFormAccount` con el grupo `credit` — mirror del drawer-loader web: `type: 'credit'`, `balances: { ARS: 0, USD: 0 }`, `avatar: resolveAccountAvatar(...)` de `@grana/ui-contracts`.
- [x] 1.3 En `MovementForm.tsx`, mostrar el hint `transactions.drawer.credit_hint` en la fila de una cuenta credit (tab Gasto). Verificar que las tabs Ingreso/Transferencia no ofrecen credit (gate `eligibleFor` del hook, sale gratis).

## 2. UI de cuotas (Decisión 3)

- [x] 2.1 Sección "Cuotas" en `MovementForm.tsx`, visible con credit seleccionada en Gasto y moneda ARS: chips preset `1·3·6·12` + opción "Otra" con stepper (−/input numérico/＋) acotado 2–60 (`INSTALLMENT_OPTIONS`/`MAX_INSTALLMENTS` locales, espejo del web), wire a `form.installments`/`form.setInstallments`.
- [x] 2.2 Preview por cuota cuando `form.isInstallments`: `Money.divide(Money.from(amount), n)` formateado, mirror del `installmentPreview` web.
- [x] 2.3 Con moneda USD en credit: ocultar chips y mostrar el hint `installments_options.ars_only` (cuotas sólo ARS; el consumo simple USD sigue permitido).
- [x] 2.4 CTA dinámico: `actions.register_installments` con `{count}` cuando `form.isInstallments`; el submit ya rutea a `registerInstallments` vía el hook (verificar, no tocar).

## 3. Bloque de reintegro (Decisión 4)

- [x] 3.1 Toggle "Reintegro" (card expandible, mirror del split compartido), visible con `tab === 'expense' && !form.isInstallments`, wire a `form.reimbursementEnabled`.
- [x] 3.2 Monto estimado (`MoneyAmountInput`) + inputs auxiliares % y tope wire a `form.applyReimbursementPercent(percent, cap)`.
- [x] 3.3 Radio de destino (a cuenta / a resumen) sólo con credit (`form.reimbursementTarget`); cash/bank queda implícito en 'account' sin radio.
- [x] 3.4 Picker de cuenta de acreditación (cash/bank) cuando `!isCredit || target === 'account'`, wire a `form.reimbursementAccountId`; verificar el default al encender el toggle (cascada del hook / re-pick del web).
- [x] 3.5 Checkbox "Ya lo recibí" (`Switch`) + hint condicional (`received_now_hint` / `pending_hint`), wire a `form.reimbursementReceivedNow`.
- [x] 3.6 Reconciliado con main (9c9baeb): el reintegro se ofrece también sobre compras en cuotas (ya no excluyentes); el bloque se muestra con `tab === 'expense'`, a paridad con web.

## 4. i18n

- [x] 4.1 Verificar que todas las keys usadas existen en `@grana/i18n-messages` (`reimbursement.*`, `installments_options.*`, `labels.installments`, `drawer.credit_hint`, `actions.register_installments`); agregar sólo labels de pantalla faltantes a es.json + en.json (paridad de keys).

## 5. Verificación

- [x] 5.1 Typecheck mobile + web en verde; lint en verde.
- [x] 5.2 Cero diffs en `apps/web/` ✓. `packages/` toca una sola línea documentada: `useMovementForm` deja `useTransition` (async transition + Suspense de expo-router = pantalla en blanco en el submit, expo/expo#37155) por un flag `isPending` explícito — web-neutral (9 tests del hook + 466 de web verdes). Ver design.md Decisión 2.
- [x] 5.3 Smoke en device: alta simple (cash/bank y tarjeta), fix de pantalla blanca en submit, spinner "Guardando…" en el CTA, y form fresco al reabrir tras crear (remount on focus). Confirmado por el usuario.
