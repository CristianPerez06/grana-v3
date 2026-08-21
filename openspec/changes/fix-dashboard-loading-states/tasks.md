## 1. Spec — restaurar y completar

- [x] 1.1 Delta `specs/dashboard/spec.md` con los tres requirements `MODIFIED` **completos**: skeletons shape-matched (reglas restauradas + regla por bloque + prohibición del vacío falso + excepción de Compartido), tolerancia a datos parciales (independencia por bloque + `min-height` restaurados) y naming espejo mobile (inventario vigente)
- [x] 1.2 Delta `specs/route-loading-and-errors/spec.md` con los dos requirements `MODIFIED` que nombran skeletons dados de baja
- [x] 1.3 `openspec validate fix-dashboard-loading-states` pasa

## 2. Web — "Cuánto gastaste"

- [ ] 2.1 Crear `apps/web/app/(app)/dashboard/_components/spent-card-skeleton.tsx`: `Card` + `CardHeader` con el título y el link reales, cuerpo con tres tiles y la tira de ritmo, `aria-busy` y `aria-label` de `dashboard.spent.loading`
- [ ] 2.2 Envolver `SpentCardContainer` en su propio `<Suspense>` en `dashboard-content.tsx` con ese fallback
- [ ] 2.3 Agregar la rama de carga en `spent-card.tsx`: mientras `isPending`, cuerpo en skeleton — **sin** derivar `isEmpty` de montos que valen 0 por no haber resuelto. El vacío real solo cuando la lectura resolvió en cero
- [ ] 2.4 `dashboard/loading.tsx`: reemplazar el `CommittedSkeleton` duplicado por el skeleton nuevo
- [ ] 2.5 Verificar que el encabezado (título + "Ver detalle ›") se ve desde el primer paint y que el cuerpo no salta al resolver (`min-height` matcheado)

## 3. Web — Saldo en navegación de mes

- [ ] 3.1 Cubrir el refetch de mes en `balance-card.tsx`: mientras la query del mes nuevo no resuelve, las zonas de importes van a skeleton en vez de caer a `hero?.ars ?? 0`
- [ ] 3.2 Verificar que el primer render server-side sigue usando `BalanceCardSkeleton` y que no aparece doble skeleton

## 4. Mobile — "Cuánto gastaste"

- [ ] 4.1 Crear `SpentCardSkeleton` en `apps/mobile/components/dashboard/` con la forma de los tres tiles + tira de ritmo, componiendo `SkeletonBlock`, con `accessibilityState.busy` y label `dashboard.spent.loading`
- [ ] 4.2 Consumirlo en `SpentCard` y **dar de baja `SpendingSkeleton.tsx`** (sobrante del donut de "En qué se fue"; era parte de la tarea 8.2 del change anterior)
- [ ] 4.3 Verificar que el encabezado de la card queda visible durante la carga

## 5. Mobile — Compromisos y Saldo

- [ ] 5.1 `CommittedSkeleton`: que traiga la card (`rounded-2xl border bg-card p-4`) y el encabezado real — título, mes y "Ver todos" — y skeletonee solo el cuerpo. Hoy `CommittedSection` devuelve el skeleton pelado en lugar de la card
- [ ] 5.2 Crear `BalanceCardSkeleton` nativo que cubra la card completa (zona navy + "Dónde está" + "Resumen del mes") y usarlo en `BalanceCard`
- [ ] 5.3 Dar de baja `HeroSkeleton.tsx`, que cubría solo el importe del hero, una vez que 5.2 lo reemplaza
- [ ] 5.4 Quitar el render con ceros del "Resumen del mes" (`summary?.ARS.entro ?? 0` y sus pares): esa zona ya no se pinta mientras carga

## 6. i18n

- [ ] 6.1 Confirmar que `dashboard.spent.loading` (ya presente en `es` y `en`, hoy sin consumidores) queda como label de los dos skeletons nuevos
- [ ] 6.2 Dar de baja `dashboard.spending.loading` **solo si** ningún otro módulo la consume — chequear antes de borrar (el bug 8.6 del change anterior salió de una limpieza sin ese chequeo)
- [ ] 6.3 Correr el test de claves i18n que escanea los fuentes

## 7. Verificación

- [ ] 7.1 Lint y typecheck de las dos apps, y los tests de web
- [ ] 7.2 Recorrer a mano en web: carga inicial, cambio de mes, usuario sin gastos (vacío real), y falla de una lectura
- [ ] 7.3 Recorrer a mano en nativo lo mismo, más `prefers-reduced-motion` activado
- [ ] 7.4 Verificar que la tira Compartido no dibuja skeleton ni reserva alto en ninguna de las dos plataformas

## 8. Archivo (pre-merge, obligatorio)

- [ ] 8.1 Mover `openspec/changes/fix-dashboard-loading-states/` a `openspec/changes/archive/YYYY-MM-DD-fix-dashboard-loading-states/`
- [ ] 8.2 Aplicar los deltas sobre `openspec/specs/dashboard/spec.md` y `openspec/specs/route-loading-and-errors/spec.md`, integrándolos en la sección plana `## Requirements`
- [ ] 8.3 **Verificar requirement por requirement que el reemplazo no pierde reglas**: comparar el largo y el contenido del requirement viejo contra el nuevo antes de guardar. Este change existe porque ese chequeo no se hizo la vez anterior
- [ ] 8.4 Correr `pnpm openspec:check`
