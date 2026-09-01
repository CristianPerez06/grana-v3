# Tasks: committed-outlook-follows-month

## 1. La lectura: dos fechas, dos roles

- [ ] 1.1 `packages/dashboard/src/types.ts`: `CommittedOutlook` gana `window: { start: string; end: string }`, `snapshotDate: string` y `mode: 'current' | 'past'`
- [ ] 1.2 `packages/dashboard/src/queries.ts`: reemplazar `nextMonthWindow(todayISO)` por un derivador puro `resolveCommittedWindow({ year, month, todayISO })` que devuelva `{ window, snapshotDate, mode }`, con `snapshotDate = todayISO` sólo cuando `(year, month)` es el mes en curso
- [ ] 1.3 Renombrar `getCommittedOutlook` → `getCommittedOutlookForMonth(supabase, { year, month, todayISO })`; actualizar el export de `packages/dashboard/src/index.ts`
- [ ] 1.4 Reescribir el comentario de cabecera del read: hoy afirma que la ventana es fija relativa a hoy y que no sigue al navegador

## 2. Tarjetas: reconstrucción as-of

- [ ] 2.1 `card_periods`: en `mode: 'past'` acotar a `due_date` dentro de la ventana (sin el superset `lte(window.end)` que hoy trae el arrastre de vencidos)
- [ ] 2.2 Leer la fecha financiera del pago (`period_payments` → `transactions.date`) en vez de la mera existencia del pago; un pago posterior al `snapshotDate` deja el resumen como pendiente en esa foto
- [ ] 2.3 Cortar los consumos del período en `date <= snapshotDate`
- [ ] 2.4 `packages/dashboard/src/aggregations.ts`: `aggregateCardDebtAsOf`, que normaliza los consumos `paid` a pendientes cuando el pago es posterior al snapshot. Apoyarse en `computePeriodAmounts` (`@grana/cards`) para el tratamiento del reintegro "en resumen" — NO re-derivarlo
- [ ] 2.5 `aggregateCardDebtByCard`: misma normalización, para que las filas por tarjeta sigan sumando el headline
- [ ] 2.6 "Vencido": `mode: 'current'` mantiene `due_date < todayISO`; `mode: 'past'` calcula en su lugar cuánto de la ventana sigue impago hoy

## 3. Gastos fijos: registro en ventana pasada

- [ ] 3.1 `mode: 'current'`: sin cambios (instancias `pending` + proyección de reglas activas)
- [ ] 3.2 `mode: 'past'`: leer `recurrence_instances` de la ventana con status `confirmed` o `pending`; excluir `skipped`
- [ ] 3.3 `mode: 'past'`: NO proyectar reglas activas — dejarlo comentado con el motivo (montos actuales, reglas dadas de baja, reglas creadas después)
- [ ] 3.4 Mantener la exclusión "pagado con tarjeta" en los dos modos

## 4. Web

- [ ] 4.1 Nuevo `apps/web/app/(app)/dashboard/_components/use-committed-month.ts`: `useQuery` con key `['dashboard', 'committed', year, month]` e `initialData` sólo cuando el mes seleccionado es el actual — el patrón de `use-balance-month.ts`
- [ ] 4.2 `committed-section-container.tsx`: pasa a resolver el mes actual server-side y entregarlo como `initialData`; se elimina el `new Date()` que arma el label
- [ ] 4.3 `committed-section.tsx`: rotula desde `window`/`mode` del resultado; título y nota al pie condicionales
- [ ] 4.4 Estado de carga in-card al navegar a un mes no cacheado (reusar `CommittedSkeleton`, chrome visible), y error compacto que no tumbe la fila

## 5. Mobile (mismo commit)

- [ ] 5.1 `apps/mobile/lib/dashboard/queries.ts`: `useCommittedOutlook({ year, month })` con el mes en la `queryKey`; borrar el comentario "static from today"
- [ ] 5.2 `apps/mobile/components/dashboard/CommittedSection.tsx`: consumir el mes del `DashboardMonthContext`, eliminar `monthLabel()` con `new Date()`, rotular desde el resultado
- [ ] 5.3 Verificar paridad de copy y de alto de card entre web a viewport de teléfono y app nativa

## 6. i18n

- [ ] 6.1 `dashboard.committed.title_past` (título de ventana pasada) y la variante de la nota al pie ("todavía impago"), en `es.json` y `en.json`
- [ ] 6.2 Confirmar que ninguna plataforma arma el nombre del mes por su cuenta

## 7. Tests

- [ ] 7.1 Migrar los 15 casos de `packages/dashboard/__tests__/committed-outlook.test.ts` a la firma nueva (mes actual → mismos resultados que hoy: es la garantía de no-regresión)
- [ ] 7.2 Casos de ventana pasada: resumen pagado después del corte (entra), pagado antes del corte (no entra), sin pagar (entra)
- [ ] 7.3 Caso de consumos: resumen que al corte no había cerrado aporta sólo lo acumulado hasta el `snapshotDate`
- [ ] 7.4 Casos de gastos fijos en ventana pasada: `confirmed` entra, `pending` entra, `skipped` no; la proyección no aporta nada
- [ ] 7.5 Test de estabilidad: el total de una ventana pasada no cambia al registrarse un pago con fecha posterior al corte
- [ ] 7.6 Test del derivador puro `resolveCommittedWindow`, incluidos los bordes (mes actual, mes actual −1, diciembre → enero del año siguiente)
- [ ] 7.7 Verificar que los tests nuevos fallan sin el fix

## 8. Cierre

- [ ] 8.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint` + `pnpm test` + `pnpm --filter dashboard test` en verde
- [ ] 8.2 Verificación manual en las dos plataformas: navegar 3 meses hacia atrás y comprobar que el encabezado y los montos se mueven, y que el mes actual muestra exactamente lo mismo que antes del cambio
- [ ] 8.3 Actualizar los specs base desde el delta al archivar el change (flujo `opsx:archive` habitual)
