# Tasks: committed-outlook-follows-month

## 1. La lectura: dos fechas, dos roles

- [x] 1.1 `packages/dashboard/src/types.ts`: `CommittedOutlook` gana `window: { start: string; end: string }`, `snapshotDate: string`, `lens: 'live' | 'snapshot'` y `windowElapsed: boolean`
- [x] 1.2 `packages/dashboard/src/queries.ts`: reemplazar `nextMonthWindow(todayISO)` por un derivador puro `resolveCommittedWindow({ year, month, todayISO })` que devuelva los cuatro campos. `lens` sale de si `(year, month)` es el mes en curso; `windowElapsed` de si la ventana terminó. NO derivar uno del otro
- [x] 1.3 Renombrar `getCommittedOutlook` → `getCommittedOutlookForMonth(supabase, { year, month, todayISO })`; actualizar el export de `packages/dashboard/src/index.ts`
- [x] 1.4 Reescribir el comentario de cabecera del read: hoy afirma que la ventana es fija relativa a hoy y que no sigue al navegador

## 2. Tarjetas: reconstrucción as-of

- [x] 2.1 `card_periods`: mantener `.lte('due_date', window.end)` en **las dos** lentes — el arrastre de vencidos existe en ambas. Partir el resultado en ventana (`due_date` dentro) y arrastre (`due_date < snapshotDate` e impago al corte)
- [x] 2.2 Leer la fecha financiera del pago (`period_payments` → `transactions.date`) en vez de la mera existencia del pago; un pago posterior al `snapshotDate` deja el resumen como pendiente en esa foto
- [x] 2.3 NO cortar los consumos por fecha; dejar comentado el motivo (las cuotas se insertan en la compra fechadas hacia adelante, un corte por `date` las perdería)
- [x] 2.4 Promover `computePeriodAmounts` de `packages/cards/src/period-amounts.ts` a `@grana/money-logic` y reexportarla desde `@grana/cards`. Sin esto `@grana/dashboard` no puede consumirla: cerraría el ciclo `dashboard → cards → transactions → dashboard`
- [x] 2.5 `packages/dashboard/src/aggregations.ts`: `aggregateCardDebtAsOf`, que suma los consumos del período sin mirar `status` y descuenta los reintegros recibidos, apoyada en `computePeriodAmounts` — NO re-derivar ese tratamiento
- [x] 2.6 `aggregateCardDebtByCard`: misma normalización, para que las filas por tarjeta sigan sumando el headline
- [x] 2.7 "Vencido": una sola regla en las dos lentes — `due_date < snapshotDate` e impago **al snapshot**. Con `lens: 'live'` el snapshot es hoy, así que el comportamiento actual sale sin caso especial

## 3. Gastos fijos: registro en ventana pasada

- [x] 3.1 Filtro de status por `lens`: `live` → sólo `pending`; `snapshot` → `confirmed` + `pending`. `skipped` nunca
- [x] 3.2 Proyección por `windowElapsed`: aporta mientras la ventana no haya terminado (incluida la posición "mes anterior"), no aporta después — comentar el motivo (montos actuales, reglas dadas de baja, reglas creadas después)
- [x] 3.3 Verificar que instancias y proyección no se solapan en la posición "mes anterior", donde conviven las dos fuentes
- [x] 3.4 Mantener la exclusión "pagado con tarjeta" en los dos modos

## 4. Web

- [x] 4.1 Nuevo `apps/web/app/(app)/dashboard/_components/use-committed-month.ts`: `useQuery` con key `['dashboard', 'committed', year, month]` e `initialData` sólo cuando el mes seleccionado es el actual — el patrón de `use-balance-month.ts`
- [x] 4.2 `committed-section-container.tsx`: pasa a resolver el mes actual server-side y entregarlo como `initialData`; se elimina el `new Date()` que arma el label
- [x] 4.3 `committed-section.tsx`: rotula desde `window`/`lens`/`windowElapsed` del resultado; título en tres estados y nota al pie condicional
- [x] 4.4 Estado de carga in-card al navegar a un mes no cacheado (reusar `CommittedSkeleton`, chrome visible), y error compacto que no tumbe la fila

## 5. Mobile (mismo commit)

- [x] 5.1 `apps/mobile/lib/dashboard/queries.ts`: `useCommittedOutlook({ year, month })` con el mes en la `queryKey`; borrar el comentario "static from today"
- [x] 5.2 `apps/mobile/components/dashboard/CommittedSection.tsx`: consumir el mes del `DashboardMonthContext`, eliminar `monthLabel()` con `new Date()`, rotular desde el resultado
- [ ] 5.3 Paridad **nativa** sin verificar visualmente: no hubo simulador disponible. El código comparte contrato y tipa limpio, y los tres estados de copy son los mismos, pero nadie abrió la app nativa. Pendiente para quien la levante

## 6. i18n

- [x] 6.1 Dos keys de título nuevas (ventana en curso vista desde su cierre, y ventana ya terminada) en `es.json` y `en.json`. La nota al pie NO necesita variante: conserva un solo significado en las tres posiciones
- [x] 6.2 Confirmar que ninguna plataforma arma el nombre del mes por su cuenta

## 7. Tests

- [x] 7.1 Migrar los 15 casos de `packages/dashboard/__tests__/committed-outlook.test.ts` a la firma nueva (mes actual → mismos resultados que hoy: es la garantía de no-regresión)
- [x] 7.2 Casos de ventana pasada: resumen pagado después del corte (entra), pagado antes del corte (no entra), sin pagar (entra)
- [x] 7.3 Caso de cuotas: una compra en N cuotas hecha antes del corte, con hijos fechados dentro de la ventana, suma completa en la foto — el test que clava que NO hay corte de consumos
- [x] 7.3b Caso de resumen abierto al corte: aporta su contenido completo, y el total no cambia al cerrarse
- [x] 7.4 Casos de gastos fijos en ventana pasada: `confirmed` entra, `pending` entra, `skipped` no; la proyección no aporta nada
- [x] 7.5 Tests de estabilidad: (a) el total no cambia al registrarse un pago con fecha posterior al corte; (b) el total de gastos fijos de la posición "mes anterior" no encoge a medida que se confirman instancias de la ventana
- [x] 7.6 Test del derivador puro `resolveCommittedWindow`: las tres posiciones del navegador con su `lens` y su `windowElapsed`, el 1º de mes mirando el mes anterior (el caso que rompía el campo único), y diciembre → enero del año siguiente
- [x] 7.7 Verificar que los tests nuevos fallan sin el fix — 6 de los 10 casos nuevos caen al revertir los cuatro predicados; los otros 4 son *guards* (fijan que NO se agregó un corte de consumos y que la proyección sigue viva con la ventana en curso), y por construcción pasan en las dos versiones

## 8. Cierre

- [x] 8.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint` + `pnpm test` + `pnpm --filter dashboard test` en verde
- [x] 8.2 Verificación manual **en web**: 3 usuarios reales × 4 posiciones del navegador, contrastados contra una auditoría SQL de los insumos. 12/12 sin discrepancias numéricas (tarjetas, gastos fijos, total, barra, vencido, línea USD y conteo de tarjetas). El mes actual coincide con producción
- [x] 8.3 Specs base actualizados desde el delta al archivar (3 requirements MODIFIED integrados en `openspec/specs/dashboard/spec.md`)
