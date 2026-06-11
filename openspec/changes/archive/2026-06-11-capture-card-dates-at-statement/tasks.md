# Tasks â€” capture-card-dates-at-statement

## 1. ValidaciÃ³n y lÃ³gica compartida

- [x] 1.1 `packages/validation/src/credit-cards.ts`: quitar `next_end_date`/`next_due_date` de `createCreditCardSchema` (queda current cierre+vto con su test de orden); actualizar `CreateCreditCardInput`
- [x] 1.2 `packages/validation/src/credit-cards.ts`: mantener shape de `payCardPeriodSchema` y documentar la nueva semÃ¡ntica (fechas de P(n+1)); la validaciÃ³n contra el ancla (`> P(n).end_date`) vive en la action
- [x] 1.3 `packages/money-logic/src/cards.ts`: verificar que `suggestNextPeriodDates` proyecta bien con un solo perÃ­odo de historial (caso alta); agregar test si falta

## 2. Action de alta

- [x] 2.1 `createCreditCard`: aceptar 2 fechas; insertar P1 real (start = cierre âˆ’ 30d) y P2 estimado (`start = cierre + 1d`, fechas vÃ­a `suggestNextPeriodDates`, `is_estimated=true`)
- [x] 2.2 Ajustar/eliminar el sanity check de `next_due_date` (90 dÃ­as) que ya no aplica al input del alta
- [x] 2.3 Tests de la action: alta crea P1 `is_estimated=false` + P2 `is_estimated=true`; consumo post-cierre cae en P2 sin pedir fechas

## 3. Action de pago

- [x] 3.1 `payCardPeriod`: re-anclar la validaciÃ³n de `next_end_date` a `P(n).end_date` (en lugar de `max(end_date)`) con mensaje localizado que nombre el ancla
- [x] 3.2 `payCardPeriod`: reemplazar el upsert de P(n+2) por la confirmaciÃ³n de P(n+1) â€” update `end_date`/`due_date` + `is_estimated=false`, reusando la cascada de ediciÃ³n de fechas (reasignaciÃ³n de transacciones cuando el cierre real difiere)
- [x] 3.3 `payCardPeriod`: re-proyectar P(n+2) estimado/vacÃ­o cuando el cierre confirmado lo invade (en lugar de rechazar); conservar el rechazo cuando tiene transacciones, pago o fechas confirmadas
- [x] 3.4 `payCardPeriod`: garantizar P(n+2) estimado eager tras la confirmaciÃ³n (crear si no existe; conservar si ya estaba)
- [x] 3.5 Tests de la action: caso feliz (confirma P2 + crea P3), cierre real anterior con reasignaciÃ³n de consumo, re-proyecciÃ³n de P3 vacÃ­o, rechazo de cierre â‰¤ P(n).end_date

## 4. UI â€” formulario de alta

- [x] 4.1 `create-card-form.tsx`: quitar la secciÃ³n "PrÃ³ximo resumen" (campos, estado, gating de submit, validate)
- [x] 4.2 i18n (`es.json`/`en.json`): eliminar labels/errores del prÃ³ximo resumen en alta; revisar copys de la secciÃ³n de ciclo

## 5. UI â€” formulario de pago

- [x] 5.1 `pay-card-period-form.tsx`: pre-llenar con las fechas persistidas de P(n+1) (no proyecciÃ³n de P(n+2)); copy de confirmaciÃ³n ("fechas del ciclo en curso, confirmalas con tu resumen")
- [x] 5.2 Ajustar la query/props del form de pago para recibir el perÃ­odo en curso con su flag `is_estimated`
- [x] 5.3 i18n: copys nuevos del bloque de confirmaciÃ³n

## 6. UI â€” seÃ±alizaciÃ³n de estimado

- [x] 6.1 `lifecycle-timeline.tsx`: marca discreta en pasos con `is_estimated=true` (p. ej. "cierra ~DD/MM")
- [x] 6.2 `edit-card-form.tsx`: indicar fechas estimadas en la secciÃ³n de ciclo y que se confirman al pagar
- [x] 6.3 Verificar que hero de `/cards`, cards del wallet y dashboard NO muestran la marca (sin cambios; solo confirmar)

## 7. Cierre

- [x] 7.1 Pasar lint, typecheck y suite de tests del monorepo
- [x] 7.2 QA manual del flujo completo: alta (2 fechas) â†’ consumo post-cierre â†’ pago con confirmaciÃ³n â†’ P3 estimado visible en timeline
- [x] 7.3 Actualizar `docs/qa/plan-de-pruebas.md` si el plan referencia el alta con 4 fechas o el pago con fechas de P(n+2)
