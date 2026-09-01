# Tasks: committed-outlook-follows-month

## 1. La lectura: dos fechas, dos roles

- [ ] 1.1 `packages/dashboard/src/types.ts`: `CommittedOutlook` gana `window: { start: string; end: string }`, `snapshotDate: string`, `lens: 'live' | 'snapshot'` y `windowElapsed: boolean`
- [ ] 1.2 `packages/dashboard/src/queries.ts`: reemplazar `nextMonthWindow(todayISO)` por un derivador puro `resolveCommittedWindow({ year, month, todayISO })` que devuelva los cuatro campos. `lens` sale de si `(year, month)` es el mes en curso; `windowElapsed` de si la ventana terminó. NO derivar uno del otro
- [ ] 1.3 Renombrar `getCommittedOutlook` → `getCommittedOutlookForMonth(supabase, { year, month, todayISO })`; actualizar el export de `packages/dashboard/src/index.ts`
- [ ] 1.4 Reescribir el comentario de cabecera del read: hoy afirma que la ventana es fija relativa a hoy y que no sigue al navegador

## 2. Tarjetas: reconstrucción as-of

- [ ] 2.1 `card_periods`: mantener `.lte('due_date', window.end)` en **las dos** lentes — el arrastre de vencidos existe en ambas. Partir el resultado en ventana (`due_date` dentro) y arrastre (`due_date < snapshotDate` e impago al corte)
- [ ] 2.2 Leer la fecha financiera del pago (`period_payments` → `transactions.date`) en vez de la mera existencia del pago; un pago posterior al `snapshotDate` deja el resumen como pendiente en esa foto
- [ ] 2.3 NO cortar los consumos por fecha; dejar comentado el motivo (las cuotas se insertan en la compra fechadas hacia adelante, un corte por `date` las perdería)
- [x] 2.4 Promover `computePeriodAmounts` de `packages/cards/src/period-amounts.ts` a `@grana/money-logic` y reexportarla desde `@grana/cards`. Sin esto `@grana/dashboard` no puede consumirla: cerraría el ciclo `dashboard → cards → transactions → dashboard`
- [ ] 2.5 `packages/dashboard/src/aggregations.ts`: `aggregateCardDebtAsOf`, que suma los consumos del período sin mirar `status` y descuenta los reintegros recibidos, apoyada en `computePeriodAmounts` — NO re-derivar ese tratamiento
- [ ] 2.6 `aggregateCardDebtByCard`: misma normalización, para que las filas por tarjeta sigan sumando el headline
- [ ] 2.7 "Vencido": una sola regla en las dos lentes — `due_date < snapshotDate` e impago **al snapshot**. Con `lens: 'live'` el snapshot es hoy, así que el comportamiento actual sale sin caso especial

## 3. Gastos fijos: registro en ventana pasada

- [ ] 3.1 Filtro de status por `lens`: `live` → sólo `pending`; `snapshot` → `confirmed` + `pending`. `skipped` nunca
- [ ] 3.2 Proyección por `windowElapsed`: aporta mientras la ventana no haya terminado (incluida la posición "mes anterior"), no aporta después — comentar el motivo (montos actuales, reglas dadas de baja, reglas creadas después)
- [ ] 3.3 Verificar que instancias y proyección no se solapan en la posición "mes anterior", donde conviven las dos fuentes
- [ ] 3.4 Mantener la exclusión "pagado con tarjeta" en los dos modos

## 4. Web

- [ ] 4.1 Nuevo `apps/web/app/(app)/dashboard/_components/use-committed-month.ts`: `useQuery` con key `['dashboard', 'committed', year, month]` e `initialData` sólo cuando el mes seleccionado es el actual — el patrón de `use-balance-month.ts`
- [ ] 4.2 `committed-section-container.tsx`: pasa a resolver el mes actual server-side y entregarlo como `initialData`; se elimina el `new Date()` que arma el label
- [ ] 4.3 `committed-section.tsx`: rotula desde `window`/`lens`/`windowElapsed` del resultado; título en tres estados y nota al pie condicional
- [ ] 4.4 Estado de carga in-card al navegar a un mes no cacheado (reusar `CommittedSkeleton`, chrome visible), y error compacto que no tumbe la fila

## 5. Mobile (mismo commit)

- [ ] 5.1 `apps/mobile/lib/dashboard/queries.ts`: `useCommittedOutlook({ year, month })` con el mes en la `queryKey`; borrar el comentario "static from today"
- [ ] 5.2 `apps/mobile/components/dashboard/CommittedSection.tsx`: consumir el mes del `DashboardMonthContext`, eliminar `monthLabel()` con `new Date()`, rotular desde el resultado
- [ ] 5.3 Verificar paridad de copy y de alto de card entre web a viewport de teléfono y app nativa

## 6. i18n

- [ ] 6.1 Dos keys de título nuevas (ventana en curso vista desde su cierre, y ventana ya terminada) en `es.json` y `en.json`. La nota al pie NO necesita variante: conserva un solo significado en las tres posiciones
- [ ] 6.2 Confirmar que ninguna plataforma arma el nombre del mes por su cuenta

## 7. Tests

- [ ] 7.1 Migrar los 15 casos de `packages/dashboard/__tests__/committed-outlook.test.ts` a la firma nueva (mes actual → mismos resultados que hoy: es la garantía de no-regresión)
- [ ] 7.2 Casos de ventana pasada: resumen pagado después del corte (entra), pagado antes del corte (no entra), sin pagar (entra)
- [ ] 7.3 Caso de cuotas: una compra en N cuotas hecha antes del corte, con hijos fechados dentro de la ventana, suma completa en la foto — el test que clava que NO hay corte de consumos
- [ ] 7.3b Caso de resumen abierto al corte: aporta su contenido completo, y el total no cambia al cerrarse
- [ ] 7.4 Casos de gastos fijos en ventana pasada: `confirmed` entra, `pending` entra, `skipped` no; la proyección no aporta nada
- [ ] 7.5 Tests de estabilidad: (a) el total no cambia al registrarse un pago con fecha posterior al corte; (b) el total de gastos fijos de la posición "mes anterior" no encoge a medida que se confirman instancias de la ventana
- [ ] 7.6 Test del derivador puro `resolveCommittedWindow`: las tres posiciones del navegador con su `lens` y su `windowElapsed`, el 1º de mes mirando el mes anterior (el caso que rompía el campo único), y diciembre → enero del año siguiente
- [ ] 7.7 Verificar que los tests nuevos fallan sin el fix

## 8. Cierre

- [ ] 8.1 `pnpm typecheck` + `pnpm typecheck:mobile` + `pnpm lint` + `pnpm test` + `pnpm --filter dashboard test` en verde
- [ ] 8.2 Verificación manual en las dos plataformas: navegar 3 meses hacia atrás y comprobar que el encabezado y los montos se mueven, y que el mes actual muestra exactamente lo mismo que antes del cambio
- [ ] 8.3 Actualizar los specs base desde el delta al archivar el change (flujo `opsx:archive` habitual)
