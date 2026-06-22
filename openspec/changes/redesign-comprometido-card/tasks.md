## 1. Confirmaciones previas (bloqueantes de diseño)

- [x] 1.1 Confirmar con el usuario si se conserva la sección de ingreso recurrente "Ya entra" + banda de cierre neto (CONFIRMADO: se conserva)
- [x] 1.2 Definir y aprobar el mockup mobile en `docs/design/dashboard-comprometido/mobile/` (aprobado)
- [x] 1.3 Fijar wording final (CONFIRMADO): subtítulo "Plata que ya está comprometida"; titular "Total a pagar"; "Resúmenes de tarjeta" (= a pagar + en curso); "Recurrencias · pendientes de confirmar"; aviso "Incluye $X vencido sin pagar". (Sin línea de "fijos del próximo mes".) Falta sólo el paralelo en inglés.

## 2. Lógica compartida ("A pagar" como fuente única)

- [x] 2.1 Definición compartida de "A pagar": en vez de extraer/reconectar el fetch del módulo Tarjetas (producción, alto riesgo), `getCommittedOutlook` reusa `aggregateCardDebt` (misma matemática pendiente−reintegros que el módulo Tarjetas) sobre los resúmenes `end_date < hoy` impagos (cerrados/vencidos). Módulo Tarjetas NO tocado.
- [x] 2.2 (Reemplazada por 2.1) Cards module sin tocar; paridad garantizada por usar la misma matemática + el test de paridad (2.3). El header de Tarjetas no cambia.
- [x] 2.3 Tests del split overdue/total con la misma matemática (`aggregateCardDebt overdue split`) + helpers `topCommittedItems`/`sumByCurrency`.

## 3. Capa de datos (`packages/dashboard`)

- [x] 3.1 Tipo extendido (`CommittedCurrency`): `debt` (= A pagar cerrados/vencidos), `overdue` (subset vencido), `recurringExpense` (= pendientes de confirmar), `recurringIncome`, `topCard`/`topRecurring` (`CommittedItem[]`). Nombres legacy conservados para no romper la UI actual; el redesign de UI los relabela.
- [x] 3.2 `getCommittedOutlook` reescrito: tarjeta = resúmenes ya empezados impagos (`start_date<=hoy` = a pagar + en curso; excluye futuros) + `overdue` subset + recurrencias `status='pending'` tipo expense (vía `recurrence_instances`). NO proyecta fijos del mes próximo. Mantiene proyección de INGRESO mes próximo para "Ya entra".
- [x] 3.3 Top-N por sección con `topCommittedItems` (pura, testeable) + `sumByCurrency`.
- [x] 3.4 Tests de los helpers puros nuevos + split overdue (30 tests en verde). (El fetch en sí no es unit-test; queda el QA de paridad en 7.3.)

## 4. UI web

- [x] 4.1 `committed-section.tsx` reescrito: total a pagar (ARS + USD), secciones "Resúmenes de tarjeta" y "Recurrencias · pendientes de confirmar", top-movimientos por sección, aviso de vencido, contexto "Ya entra" + neto, USD consistente.
- [x] 4.2 Tiles cuadrados reemplazados por el layout de secciones/filas del mockup aprobado.
- [x] 4.3 `committed-skeleton.tsx` actualizado al nuevo shape (total + 2 secciones con filas).
- [x] 4.4 Eye-mask en todos los importes (vía `MaskedAmount`/`MaskedAmountDisplay`).
- [x] 4.5 Estado vacío ("No tenés nada por pagar por ahora") + error compacto (sin cambios).

## 5. i18n

- [x] 5.1 Claves nuevas en es/en (`card_label`, `card_hint`, `recurring_label`, `recurring_hint`, `view_cards`, `view_recurring`, `overdue`) + `question`/`total_label`/`empty` actualizadas. Claves legacy (`debt`, `recurring_expense`, `next_month`, `outflow_label`) conservadas porque la `CommittedSection` mobile aún las usa (se limpian en el Chunk 6).

## 6. Paridad mobile

- [ ] 6.1 Reescribir `apps/mobile/components/dashboard/CommittedSection.tsx` con el mismo modelo (consume la query compartida) según el mockup mobile
- [ ] 6.2 Actualizar `CommittedSkeleton` nativa
- [ ] 6.3 Verificar eye-mask y bimoneda en nativo

## 7. Verificación

- [ ] 7.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint`
- [ ] 7.2 Tests de `@grana/dashboard` y de la lógica "A pagar" en verde
- [ ] 7.3 QA manual: comparar el número "tarjeta a pagar" del Comprometido contra el header del módulo Tarjetas (deben coincidir) con datos reales (usuario QA)
- [ ] 7.4 Actualizar el handoff/README y archivar el change (OpenSpec) en la branch antes de mergear
