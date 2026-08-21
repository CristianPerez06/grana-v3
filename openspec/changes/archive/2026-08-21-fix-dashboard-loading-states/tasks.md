## 1. Spec — restaurar y completar

- [x] 1.1 Delta `specs/dashboard/spec.md` con los tres requirements `MODIFIED` **completos**: skeletons shape-matched (reglas restauradas + regla por bloque + prohibición del vacío falso + excepción de Compartido), tolerancia a datos parciales (independencia por bloque + `min-height` restaurados) y naming espejo mobile (inventario vigente)
- [x] 1.2 Delta `specs/route-loading-and-errors/spec.md` con los dos requirements `MODIFIED` que nombran skeletons dados de baja
- [x] 1.3 `openspec validate fix-dashboard-loading-states` pasa

## 2. Web — "Cuánto gastaste"

- [x] 2.1 Crear `apps/web/app/(app)/dashboard/_components/spent-card-skeleton.tsx` (+ `spent-card-body-skeleton.tsx`, el cuerpo compartido: el fallback del Suspense es server y la rama de carga de la card es client, así que el cuerpo no puede vivir en el módulo que importa `next-intl/server`): `Card` + `CardHeader` con el título y el link reales, cuerpo con tres tiles y la tira de ritmo, `aria-busy` y `aria-label` de `dashboard.spent.loading`
- [x] 2.2 Envolver `SpentCardContainer` en su propio `<Suspense>` en `dashboard-content.tsx` con ese fallback
- [x] 2.3 Agregar la rama de carga en `spent-card.tsx`: mientras `isPending`, cuerpo en skeleton — **sin** derivar `isEmpty` de montos que valen 0 por no haber resuelto. El vacío real solo cuando la lectura resolvió en cero
- [x] 2.4 `dashboard/loading.tsx`: reemplazar el `CommittedSkeleton` duplicado por el skeleton nuevo
- [x] 2.5 Verificar que el encabezado (título + "Ver detalle ›") se ve desde el primer paint y que el cuerpo no salta al resolver (`min-height` matcheado)

## 3. Web — Saldo

- [x] 3.0 **Reescribir `balance-card-skeleton.tsx` para que coincida con la card.** Quedó en la composición previa a los fixes de ancho angosto: grillas de dos y tres columnas fijas donde la card se apila por debajo de `sm`, el resumen sin los dots ni la línea USD, y los divisores del lado equivocado. Ahora espeja `PlacementColumn` y `Flow` con sus mismas clases responsive
- [x] 3.1 Cubrir el refetch de mes en `balance-card.tsx`: `useBalanceMonth` expone `isLoading` y las zonas de importes —hero, línea USD, columnas de cuentas y los tres montos del resumen— van a skeleton en vez de caer a `hero?.ars ?? 0`. Los rótulos, el link y los labels del resumen se quedan reales: no dependen de la lectura y son los que dicen a qué mes estás mirando. Las piezas se extrajeron a `balance-card-body-skeleton.tsx` para que las compartan el fallback del Suspense (server) y la card (client)
- [x] 3.2 Verificar que el primer render server-side sigue usando `BalanceCardSkeleton` y que no aparece doble skeleton

## 4. Mobile — "Cuánto gastaste"

- [x] 4.1 Crear `SpentCardSkeleton` en `apps/mobile/components/dashboard/` con la forma de los tres tiles + tira de ritmo, componiendo `SkeletonBlock`, con `accessibilityState.busy` y label `dashboard.spent.loading`
- [x] 4.2 Consumirlo en `SpentCard` y **dar de baja `SpendingSkeleton.tsx`** (sobrante del donut de "En qué se fue"; era parte de la tarea 8.2 del change anterior)
- [x] 4.3 Verificar que el encabezado de la card queda visible durante la carga

## 5. Mobile — Compromisos y Saldo

- [x] 5.1 `CommittedSkeleton` pasa a ser **cuerpo only** (resumen con total, barra y leyenda + las dos filas de grupo) y `CommittedSection` renderiza la card y el encabezado en los tres estados: cargando, con error y con datos. El estado de error también gana el encabezado, que antes era una card pelada con una línea de texto
- [x] 5.2 Crear `BalanceCardSkeleton` nativo que cubra la card completa (zona navy + "Dónde está" + "Resumen del mes") y usarlo en `BalanceCard`. El eyebrow, el importe y la línea USD van centrados como en la card: el `HeroSkeleton` los dibujaba contra el borde izquierdo
- [x] 5.3 Dar de baja `HeroSkeleton.tsx`, que cubría solo el importe del hero, una vez que 5.2 lo reemplaza
- [x] 5.5 Alinear el nativo con web en el **cambio de mes**: la card completa en gris es solo para la primera carga (mes actual pendiente); navegando a otro mes el marco se queda y pulsan solo los importes — hero, línea USD, columnas de cuentas y los tres montos del resumen. `BalanceCardSkeleton` exporta esas piezas y el skeleton completo las compone, así las dos rutas no pueden divergir
- [x] 5.4 Quitar el render con ceros del "Resumen del mes" (`summary?.ARS.entro ?? 0` y sus pares): esa zona ya no se pinta mientras carga

## 6. i18n

- [x] 6.1 Confirmar que `dashboard.spent.loading` (ya presente en `es` y `en`, hoy sin consumidores) queda como label de los dos skeletons nuevos
- [x] 6.2 Dar de baja `dashboard.spending.loading` **solo si** ningún otro módulo la consume — chequear antes de borrar (el bug 8.6 del change anterior salió de una limpieza sin ese chequeo)
- [x] 6.3 Correr el test de claves i18n que escanea los fuentes

## 7. Verificación

Las de recorrido a mano las validó el usuario en las dos plataformas el 2026-08-21, con el flag temporal `qa-force-loading` que forzaba el estado de carga de cada bloque; el flag se quitó después de validar.

- [x] 7.1 Lint y typecheck de las dos apps, y los tests de web
- [x] 7.2 Recorrer a mano en web: carga inicial, cambio de mes, usuario sin gastos (vacío real), y falla de una lectura
- [x] 7.3 Recorrer a mano en nativo lo mismo, más `prefers-reduced-motion` activado
- [x] 7.4 Verificar que la tira Compartido no dibuja skeleton ni reserva alto en ninguna de las dos plataformas

## 8. Archivo (pre-merge, obligatorio)

- [x] 8.1 Mover `openspec/changes/fix-dashboard-loading-states/` a `openspec/changes/archive/YYYY-MM-DD-fix-dashboard-loading-states/`
- [x] 8.2 Aplicar los deltas sobre `openspec/specs/dashboard/spec.md` y `openspec/specs/route-loading-and-errors/spec.md`, integrándolos en la sección plana `## Requirements`
- [x] 8.3 **Verificar requirement por requirement que el reemplazo no pierde reglas**: comparar el largo y el contenido del requirement viejo contra el nuevo antes de guardar. Este change existe porque ese chequeo no se hizo la vez anterior. Resultado del chequeo, en líneas con contenido:

  | capability | requirement | antes | después |
  |---|---|---|---|
  | `dashboard` | Las secciones … skeleton shape-matched | 13 | 60 |
  | `dashboard` | El dashboard tolera datos parciales sin romperse | 13 | 23 |
  | `dashboard` | Los componentes del dashboard mobile … naming espejo | 24 | 25 |
  | `route-loading-and-errors` | Toda ruta de apps/web … loading.tsx y error.tsx | 27 | 28 |
  | `route-loading-and-errors` | Una ruta … in-page chrome | 103 | 103 |

  Ninguno perdió contenido
- [x] 8.4 Correr `pnpm openspec:check`
