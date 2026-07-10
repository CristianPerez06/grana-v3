## 1. Schema (validation)

- [x] 1.1 Agregar `reimbursement: reimbursementDeclarationSchema.optional().default(undefined)` a `registerInstallmentsSchema` en `packages/validation/src/credit-cards.ts` (espejar `registerCardPurchaseSchema`); verificar que `RegisterInstallmentsInput` infiere el campo

## 2. Orchestrator (transactions-mutations)

- [x] 2.1 Importar `insertDeclaredReimbursement` en `packages/transactions-mutations/src/register-installments.ts`
- [x] 2.2 Tras insertar cuotas y antes/junto a `applySharedSplits`, si `data.reimbursement`: armar `declaration` con `card_period_id ?? periodIds[0]` para `target='statement'` (dejar tal cual para `'account'`) y llamar `insertDeclaredReimbursement({ userId, expenseId: parent.id, currencyCode: 'ARS', declaration, shared: data.shared, today })`
- [x] 2.3 Rollback: si el reintegro falla, borrar cuotas (`parent_id`) + madre (`id`) y devolver `formError`; confirmar que el reintegro cascadea por `ON DELETE CASCADE` al borrar la madre
- [x] 2.4 Verificar el orden vs `applySharedSplits`: el reintegro hereda `shared`, así que ambos usan `data.shared`; asegurar que un fallo posterior (split) también limpia el reintegro (vía cascade al borrar la madre)

## 3. Form hook (movement-form)

- [x] 3.1 En `packages/movement-form/src/use-movement-form.ts`, quitar `&& !isInstallments` del `if` que construye `reimbursementDecl` (~línea 430)
- [x] 3.2 En el dispatch de `registerInstallments` (~línea 513), agregar `reimbursement: reimbursementDecl`
- [x] 3.3 Confirmar que el resolver de cuenta (`reimbTarget === 'statement' ? accountId : reimbursementAccountId`, ~línea 437) resuelve correctamente para cuotas (accountId = la tarjeta) sin cambios adicionales

## 4. UI web

- [x] 4.1 En `apps/web/lib/transactions/components/movement-form.tsx`, cambiar `showReimbursementToggle` a `!isEdit && tab === 'expense'` (quitar `&& !isInstallments`, ~línea 1208)
- [x] 4.2 (QA usuario ✓ 2026-07-10) Verificar en el navegador que en una compra en cuotas: aparece el toggle "Tiene reintegro", se muestran ambos subtipos (a cuenta / en resumen), y el selector de cuenta de acreditación aparece para "a cuenta"

## 5. Verificación end-to-end

- [ ] 5.1 (QA usuario) Alta de compra en cuotas + reintegro "a cuenta" pendiente → madre + cuotas + reintegro pendiente vinculado a la madre; el reintegro no impacta saldo hasta confirmar
- [x] 5.2 (QA usuario ✓ 2026-07-09) Alta de compra en cuotas + reintegro "en resumen" recibido → verificado con data real: reintegro guardado ENTERO ($12.000, no dividido), `card_period_id` = período de la 1ª cuota, categoría derivada de la madre (Hogar). El neto negativo del mes ("te devolvieron") es comportamiento confirmado como deseado (ver design.md Decisión 6)
- [x] 5.3 (QA usuario ✓ 2026-07-10) Alta de compra en cuotas **compartida** (50/50) + reintegro recibido → verificado con SQL: compra $60.000 en 2 cuotas ($15.000/miembro/cuota) + reintegro $12.000 recibido ($6.000/miembro); deuda derivada del otro miembro = `$30.000 − $6.000 = $24.000` ✓
- [x] 5.4 (QA usuario ✓ 2026-07-10) Caso de fallo del reintegro (cuenta de acreditación vacía) → sale el error "Elegí la cuenta donde se acredita el reintegro" y NO se crea la madre ni las cuotas (atomicidad) ✓
- [x] 5.5 `pnpm typecheck` y los tests de `transactions-mutations` / `movement-form` en verde

## 6. Cierre

- [x] 6.1 Actualizar la memoria `shared-followups-2026-07` marcando el ítem #2 como implementado (branch, sin mergear)
- [ ] 6.2 (post-QA) Sincronizar specs (aplicar el delta a `openspec/specs/transactions/spec.md`) y archivar el change EN la branch antes del merge ff-only
