## 1. Confirmaciones previas (bloqueantes de diseño)

- [x] 1.1 Confirmar con el usuario si se conserva la sección de ingreso recurrente "Ya entra" + banda de cierre neto (CONFIRMADO: se conserva)
- [x] 1.2 Definir y aprobar el mockup mobile en `docs/design/dashboard-comprometido/mobile/` (aprobado)
- [x] 1.3 Fijar wording final (CONFIRMADO): subtítulo "Plata que ya está comprometida"; titular "Total a pagar"; "Tarjeta · a pagar"; "Recurrencias · pendientes de confirmar"; aviso "Incluye $X vencido sin pagar". (Sin línea de "fijos del próximo mes".) Falta sólo el paralelo en inglés.

## 2. Lógica compartida ("A pagar" como fuente única)

- [ ] 2.1 Extraer la lógica pura de "A pagar" de `apps/web/lib/cards/month-summary.ts` (suma de `pending` − reintegros sobre resúmenes cerrados/vencidos) a un módulo compartible (`@grana/money-logic` o `@grana/dashboard`), sin acoplarla a Supabase
- [ ] 2.2 Reapuntar el módulo Tarjetas (web) a la lógica extraída para que no haya duplicación (verificar que el header de Tarjetas no cambia de número)
- [ ] 2.3 Tests unitarios de la lógica "A pagar" extraída (incluye separación de la parte vencida para el aviso)

## 3. Capa de datos (`packages/dashboard`)

- [ ] 3.1 Extender el tipo `CommittedOutlook`/`CommittedCurrency`: `cardToPay`, `overdue`, `recurringPending`, `recurringNextMonth`, y `topItems` por sección (3-4, monto desc)
- [ ] 3.2 Reescribir `getCommittedOutlook`: tarjeta a pagar (lógica del paso 2) + recurrencias `status='pending'` (vía la consulta de `recurrence_instances`); total = tarjeta a pagar + pendientes de confirmar. NO proyectar fijos del mes próximo. Mantener la proyección de INGRESO recurrente del mes próximo sólo para el contexto "Ya entra" (reusa `projectUpcomingOccurrences`)
- [ ] 3.3 Calcular los top-N movimientos por sección en aggregations (función pura, testeable)
- [ ] 3.4 Tests de `aggregations`/`getCommittedOutlook` para el nuevo shape (total, exclusión de en curso/futuros y de la proyección de fijos, aviso de vencido, top-N, USD por moneda, contexto "Ya entra"/neto)

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
