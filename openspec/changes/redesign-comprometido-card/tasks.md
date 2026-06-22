## 1. Confirmaciones previas (bloqueantes de diseño)

- [x] 1.1 Confirmar con el usuario si se conserva la sección de ingreso recurrente "Ya entra" + banda de cierre neto (CONFIRMADO: se conserva)
- [x] 1.2 Definir y aprobar el mockup mobile en `docs/design/dashboard-comprometido/mobile/` (aprobado)
- [x] 1.3 Fijar wording final (CONFIRMADO): subtítulo "Plata que ya está comprometida"; titular "Total a pagar"; "Tarjeta · a pagar"; "Recurrencias · pendientes de confirmar"; aviso "Incluye $X vencido sin pagar". (Sin línea de "fijos del próximo mes".) Falta sólo el paralelo en inglés.

## 2. Lógica compartida ("A pagar" como fuente única)

- [x] 2.1 Definición compartida de "A pagar": en vez de extraer/reconectar el fetch del módulo Tarjetas (producción, alto riesgo), `getCommittedOutlook` reusa `aggregateCardDebt` (misma matemática pendiente−reintegros que el módulo Tarjetas) sobre los resúmenes `end_date < hoy` impagos (cerrados/vencidos). Módulo Tarjetas NO tocado.
- [x] 2.2 (Reemplazada por 2.1) Cards module sin tocar; paridad garantizada por usar la misma matemática + el test de paridad (2.3). El header de Tarjetas no cambia.
- [x] 2.3 Tests del split overdue/total con la misma matemática (`aggregateCardDebt overdue split`) + helpers `topCommittedItems`/`sumByCurrency`.

## 3. Capa de datos (`packages/dashboard`)

- [x] 3.1 Tipo extendido (`CommittedCurrency`): `debt` (= A pagar cerrados/vencidos), `overdue` (subset vencido), `recurringExpense` (= pendientes de confirmar), `recurringIncome`, `topCard`/`topRecurring` (`CommittedItem[]`). Nombres legacy conservados para no romper la UI actual; el redesign de UI los relabela.
- [x] 3.2 `getCommittedOutlook` reescrito: A pagar (resúmenes `end_date<hoy` impagos) + `overdue` subset + recurrencias `status='pending'` tipo expense (vía `recurrence_instances`). NO proyecta fijos del mes próximo. Mantiene proyección de INGRESO mes próximo para "Ya entra".
- [x] 3.3 Top-N por sección con `topCommittedItems` (pura, testeable) + `sumByCurrency`.
- [x] 3.4 Tests de los helpers puros nuevos + split overdue (30 tests en verde). (El fetch en sí no es unit-test; queda el QA de paridad en 7.3.)

## 4. UI web

- [ ] 4.1 Reescribir `committed-section.tsx`: total a pagar (ARS + USD), secciones "Tarjeta · a pagar" y "Recurrencias · pendientes de confirmar", top-movimientos por sección, aviso de vencido, contexto "Ya entra" + neto, USD consistente
- [ ] 4.2 Reemplazar los tiles cuadrados por el layout de filas/secciones del mockup aprobado
- [ ] 4.3 Actualizar `committed-skeleton.tsx` al nuevo shape
- [ ] 4.4 Eye-mask en todos los importes nuevos (total, subtotales, montos de movimientos)
- [ ] 4.5 Estado vacío y estado de error compactos

## 5. i18n

- [ ] 5.1 Agregar/renombrar claves en `packages/i18n-messages` (es.json y en.json) según 1.3

## 6. Paridad mobile

- [ ] 6.1 Reescribir `apps/mobile/components/dashboard/CommittedSection.tsx` con el mismo modelo (consume la query compartida) según el mockup mobile
- [ ] 6.2 Actualizar `CommittedSkeleton` nativa
- [ ] 6.3 Verificar eye-mask y bimoneda en nativo

## 7. Verificación

- [ ] 7.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint`
- [ ] 7.2 Tests de `@grana/dashboard` y de la lógica "A pagar" en verde
- [ ] 7.3 QA manual: comparar el número "tarjeta a pagar" del Comprometido contra el header del módulo Tarjetas (deben coincidir) con datos reales (usuario QA)
- [ ] 7.4 Actualizar el handoff/README y archivar el change (OpenSpec) en la branch antes de mergear
