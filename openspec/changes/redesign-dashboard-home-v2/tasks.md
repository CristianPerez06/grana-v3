## 1. Derivaciones puras en `@grana/dashboard` (D1, D2, D3, D4)

- [x] 1.1 Agregar a `packages/dashboard/src/aggregations.ts` la derivación de **reparto por cuenta y moneda**: dado el desglose del hero, devolver las **dos** cuentas de mayor saldo de cada moneda con su porcentaje sobre el total de esa moneda, ordenadas desc
- [x] 1.2 Cubrir con test los bordes de 1.1: usuario sin cuentas, una sola cuenta en una moneda, moneda con total cero (no dividir por cero), empate de saldos (orden determinístico)
- [x] 1.3 Implementar `deriveMonthSpending` (Gastaste / Pagaste / Te queda por pagar) como función pura sobre el devengado del mes y `MonthBalanceSeries.totalExpense`, **por moneda**, con la invariante `pagaste + teQuedaPorPagar === gastaste`
- [x] 1.4 Test de reconciliación de 1.3 anclando la invariante, incluido el caso sin consumo de tarjeta (`teQuedaPorPagar === 0`) y el caso sin gasto alguno
- [x] 1.5 Implementar `deriveSpendingPace` (D2): devuelve el ritmo como `gastaste / entro` por moneda, con un estado explícito `indeterminado` cuando `entro === 0` — **nunca** `0`, `NaN` ni `Infinity`
- [x] 1.6 Test de 1.5 sobre los tres estados: normal, indeterminado (denominador 0) y por encima de 100%
- [x] 1.7 Implementar la derivación de los porcentajes de la **barra apilada** de compromisos (Tarjetas / Gastos fijos sobre el total), con el caso total cero devolviendo ausencia de barra en vez de proporciones arbitrarias
- [x] 1.8 Exportar las nuevas derivaciones y tipos desde `packages/dashboard/src/index.ts`

## 2. Compromisos: ventana del próximo mes y agregación por tarjeta (D5)

- [x] 2.1 Agregar a `packages/dashboard/src/types.ts` el tipo de fila por tarjeta (nombre, total comprometido, fecha de próximo cierre) con el comentario que explica en qué se diferencia de `CommittedItem`
- [x] 2.2 Extender `getCommittedOutlook` para agrupar el conjunto "A pagar" **por tarjeta** y devolver las filas ordenadas por monto desc, junto al `topCard` actual (conviven; `topCard` se retira en 8.4 cuando ningún consumidor lo use)
- [x] 2.3 Resolver el **próximo cierre** de cada tarjeta desde el módulo Tarjetas; si el dato exige una lectura extra costosa, dejar la bajada del grupo con el conteo de tarjetas y anotarlo en `design.md` como resuelto
- [x] 2.4 Test de la agregación: varias tarjetas con varios consumos cada una, tarjeta sin consumos (no aparece), y verificación de que la suma por tarjeta iguala el `debt` total de la moneda
- [ ] 2.5 ~~Conteo de compras pendientes~~ — **descartado en la implementación.** El monto sale de `devengado − caja` (dos lecturas agregadas); no hay un conjunto de filas del que contar "compras" que case con ese monto sin inventar un criterio (una compra en 6 cuotas: ¿es una compra o es la cuota del mes?). El sub-bloque dice "Se paga en los próximos resúmenes", que es exacto y no necesita el número. Reabrir si el conteo se considera necesario

- [x] 2.6 Redefinir `getCommittedOutlook` sobre la **ventana del próximo mes calendario** (día 1 al último día), inyectable por parámetro para que los tests no dependan de la fecha real
- [x] 2.7 Tarjetas: seleccionar los resúmenes por **`due_date` dentro de la ventana** e impagos, en vez de los `start_date <= hoy`. Los vencidos (`due_date < hoy`, impagos) quedan en `overdue`, **disjunto** de `debt`
- [x] 2.8 Gastos fijos: instancias generadas con `scheduled_date` en la ventana y sin resolver **más** las ocurrencias proyectadas de las reglas activas, excluyendo las recurrencias cuya `account_id` es una tarjeta de crédito (ya viajan dentro del resumen de esa tarjeta)
- [x] 2.9 Extraer `projectRecurrenceItems` en `aggregations.ts` — la proyección devuelve **una fila por ocurrencia**, para que el subtotal y la lista del grupo salgan del mismo array. `aggregateRecurrenceProjection` queda construido encima
- [x] 2.10 Actualizar los comentarios de `CommittedCurrency` en `types.ts`: la semántica de `debt`, `overdue` y `recurringExpense` cambió y los comentarios viejos describían la anterior
- [x] 2.11 Tests de la ventana: resumen que cierra dentro pero vence después (excluido), resumen vencido (en `overdue`, fuera de `debt`), recurrencia pagada con tarjeta (excluida), instancia generada + proyección contadas una sola vez, y ARS/USD separados
- [x] 2.12 Renderizar el vencido con **etiqueta propia** en web y mobile, fuera del total, y que su sola presencia impida el estado vacío de la card

## 3. Web — Card 1 "Saldo disponible total" (D7)

- [x] 3.1 Crear el componente contenedor de la card con sus dos zonas (oscura `#142231` y clara), un solo borde exterior de radio 20px y el `border-top` como separador interno
- [x] 3.2 Zona oscura: rótulo, monto grande con signo y centavos subordinados, y fila USD condicionada por la regla bimoneda (D1)
- [x] 3.3 Bloque "Dónde está" dentro de la zona oscura: encabezado de dos columnas (ARS / USD + link "Ver cuentas"), divisor central, dos filas por moneda con cuadradito de color, nombre y porcentaje. **Sin barras de proporción**
- [x] 3.4 Limitar los bloques internos de la zona oscura a `max-width: 660px` centrados, para que en desktop los datos no se dispersen
- [x] 3.5 Zona clara "Resumen del mes": **tres** columnas iguales (Tenías, Entró, Se fué), con punto de color, monto ARS con signo en los dos flujos y línea USD condicional
- [x] 3.8 Alinear cada bloque de modo que los tres **lleguen a los dos bordes**: el primero a la izquierda, el último a la derecha, el del medio centrado. Alinear los tres a la izquierda —como estaba— dejaba una franja muerta contra el borde derecho y el bloque descentrado. Las columnas siguen siendo tercios iguales: la posición no puede depender del dato o los montos saltan al navegar de mes
- [x] 3.10 **Composición angosta**: apilar los tres montos del "Resumen del mes" (una fila cada uno, rótulo izquierda / monto derecha) y apilar las dos monedas de "Dónde está" con una cuenta por fila. En tres tercios de una card de teléfono los montos se imprimían encima unos de otros y los nombres de cuenta se truncaban a una letra
- [x] 4.12 Escala angosta para el tile completo (monto, rótulo, leyenda, ícono y padding): un tercio de una card de ancho de teléfono son ~90px de texto y la rampa de desktop **cortaba los montos**, que es el peor fallo posible en un número de plata
- [x] 3.13 Escala tipográfica propia para la composición apilada: el monto a 27px al lado de un rótulo de 14px lo aplasta y la fila deja de leerse como par. La escala apilada es la misma que usa nativo, que es la misma composición
- [x] 3.12 En la composición apilada de "Dónde está", el rótulo de moneda va como **columna izquierda** y el porcentaje al borde derecho: una fila entera para la palabra "ARS" es una fila no gastada en datos, y con los porcentajes alineados en columna se comparan de un vistazo
- [x] 3.11 Aplicar `densestAmountDensity` también a los tres montos del resumen, por la misma razón que en los tiles
- [x] 3.9 Achicar el aire de la zona clara: menos padding arriba del título y menos separación entre el título y la grilla
- [x] 3.6 Reemplazar los tres `Suspense` (hero, cuentas, balance) por **uno solo** que envuelva la card, con un skeleton shape-matched único (D7)
- [x] 3.7 Dar de baja `hero-section.tsx`, `accounts-card.tsx`, `month-balance-section.tsx` y sus contenedores/skeletons una vez que la card nueva los cubre

## 4. Web — Card 2 "Cuánto gastaste" (D2, D3, D8)

- [x] 4.1 Reescribir `spent-this-month-section.tsx` como card de tres tiles, **eliminando el `if (financed <= 0) return null`** que hoy la desmonta
- [x] 4.2 Maquetar cada tile: ícono tintado, rótulo, monto en el color del bloque, línea USD condicional, sub-bloque de contexto y filete de color al pie con `margin-top: auto`
- [x] 4.3 Conectar los tres montos a `deriveMonthSpending` (1.3) y el conteo de compras a 2.5 — sin recalcular nada en el componente
- [x] 4.4 Implementar la tira de ritmo: anillo con `conic-gradient`, copy con el porcentaje destacado, barra de progreso y pie con los dos montos ARS del cociente
- [x] 4.5 Estado **ritmo indeterminado**: mensaje explicativo en lugar del anillo. Proponer el copy exacto para revisión del usuario
- [x] 4.6 Estado **ritmo > 100%**: anillo y barra en terracota y copy ajustado. Proponer el copy exacto para revisión del usuario
- [x] 4.7 Estado **sin gasto en el mes**: estado vacío de la card, sin desmontarla
- [x] ~~4.8 Anclar la tira de ritmo al pie con `margin-top: auto`~~ — **revertido en 4.9.** Anclarla es lo que convertía el alto sobrante en un agujero en el medio de la card
- [x] 4.10 Decidir el **paso tipográfico del monto una sola vez para los tres tiles** (`densestAmountDensity` en `@grana/dashboard`, con tests): por tile, el tipo saltaba entre vecinos e invertía la jerarquía —"Gastaste" se renderizaba más chico que "Por pagar"— y con el contenido centrado los desalineaba
- [x] 4.11 Darle **alto único a la franja inferior** del tile, sea leyenda (dos líneas) o invitación a abrir (una): con la franja dimensionándose sola, los tiles que se abren quedaban más abajo que su vecino
- [x] 4.9 Hacer que los **tiles absorban el alto sobrante** (`flex-1` en la grilla, `h-full` + `min-h` en el tile, contenido centrado en las dos caras) y desanclar la tira de ritmo. La card deja de tener hueco pase lo que pase del otro lado de la fila

## 5. Web — Card 3 "Compromisos del próximo mes" (D5, D6)

- [x] 5.1 Header con el mes al que refiere y el link al listado completo
- [x] 5.2 Bloque de total: rótulo, monto ARS, línea USD condicional, barra apilada con los porcentajes de 1.7 y leyenda con cuadraditos y porcentajes
- [x] ~~5.3 Implementar el grupo desplegable~~ — **reemplazado por 5.8.** El desplegable hacia abajo sumaba ~280px al alto de la card y, como las dos cards de la fila comparten alto, el sobrante salía como un hueco en el medio de "Cuánto gastaste"
- [x] 5.4 Grupo **Tarjetas**: filas por tarjeta (2.2), hasta 3 con el grupo cerrado y el resto al desplegar, con el corte calculado sobre la lista ordenada — no un `slice` en el markup
- [x] 5.5 Grupo **Gastos fijos**: hasta 10 filas con `overflow: auto` en su propio contenedor y link "Ver mis gastos fijos". Verificar que la card completa **no** scrollea
- [x] 5.6 Estados vacíos por grupo y el vacío único de la card cuando no hay compromisos de ningún tipo
- [x] 5.7 Verificar el área táctil ≥44px de las cabeceras en el breakpoint mobile
- [x] 5.8 Reemplazar los dos desplegables por una **zona de detalle de alto fijo** (`committed-detail.tsx`): `flex-1` + `min-h` del tamaño del resumen, así mide igual en los dos estados y abrir un detalle cuesta cero píxeles. El detalle reemplaza al resumen y la lista scrollea adentro de la zona
- [x] 5.9 Accesibilidad del reemplazo: sin `aria-expanded` (no es un disclosure), región rotulada, y **movimiento de foco** al control de volver al abrir y de vuelta al control del grupo al cerrar
- [x] 5.10 Bajar el aviso de vencido a **una sola línea** dentro del bloque del total, debajo de la barra: de ~75px a ~24px

## 6. Web — Tira Compartido y layout general

- [x] 6.1 `shared-strip.tsx` ya cumplía el diseño del handoff (ícono, nombre, avatares apilados, monto direccional y chevron como único link) — se deja como está
- [x] 6.5 Tira Compartido en **una sola fila a cualquier ancho**: en angosto se sueltan los avatares de iniciales y la mitad "vos y {otro}" de la bajada, y el bloque de identidad es el que se achica para que el monto no ceda. Espejado en nativo, que además no mostraba el nombre del Hogar
- [x] 6.2 Reescribir `dashboard-content.tsx` con la grilla nueva: fila 1 a ancho completo, fila 2 `1fr / 1.12fr` con `align-items: stretch`, pie Compartido
- [x] 6.3 Colapso a una columna por debajo del ancho de contenido, con el sidebar oculto y el padding del main reducido
- [x] 6.6 Header del dashboard en **una sola fila a cualquier ancho**, con el mes abreviado a tres letras por debajo de `sm` (`responsive` en `MonthNavigator`): apilado, el selector se llevaba una píldora a ancho completo y ~44px de alto en el viewport donde el alto es lo más escaso
- [x] 6.7 Cabecera de card en **una sola fila a cualquier ancho**: el link ("Ver detalle" / "Ver todos") va al lado del título y alineado a la derecha, no apilado debajo. El título es el que se achica; el link no envuelve
- [ ] 6.4 Verificar **a ojo** que las dos cards de la fila 2 terminan alineadas en los anchos de corte, y que el alto de Compromisos no se mueve al abrir y cerrar un detalle

## 7. Mobile — espejo de las cuatro cards

- [x] 7.1 `HeroSection` / card de saldo unificada con sus dos zonas, en PascalCase espejando el naming de web
- [x] 7.8 Subir el selector de mes a la fila del saludo en el header nativo, con el mes abreviado a tres letras (`compact` en `MonthNavigator`): la píldora a ancho completo se comía ~44px de alto en la pantalla donde el alto es lo escaso
- [x] 7.7 Espejar en nativo la composición angosta de 3.10: el nativo tenía las dos monedas lado a lado y los tres montos del resumen en tres columnas, con `fitOneLine` achicando montos de ocho cifras hasta lo ilegible
- [x] 7.2 `SpentThisMonthSection` con los tres tiles y la tira de ritmo, con la escala tipográfica mobile
- [x] 7.3 `CommittedSection` con la barra apilada y la zona de detalle que reemplaza (`CommittedDetail`), con área táctil ≥44px. En nativo la pila tolera el crecimiento, pero el gesto es el mismo a propósito: la misma card no se opera de dos maneras según el dispositivo
- [x] 7.4 Crear `SharedStrip` en `apps/mobile/components/dashboard/` — **no existe hoy** — con el mismo condicional de actividad que web
- [x] 7.5 Recomponer `apps/mobile/app/(app)/dashboard.tsx` con los cuatro bloques en orden y su tolerancia a fallas parciales
- [x] 7.6 Verificar la paridad de números entre plataformas: las dos consumen las mismas derivaciones de `@grana/dashboard`

## 8. Baja de "En qué se fue" del dashboard (D9)

- [x] 8.1 Quitar la sección de `dashboard-content.tsx` y de `apps/mobile/app/(app)/dashboard.tsx`
- [x] 8.2 Dar de baja `spending-section.tsx`, `spending-section-container.tsx`, `spending-donut.tsx`, `spending-skeleton.tsx` y sus stories, y sus equivalentes nativos
- [x] 8.3 **Verificar que `getMonthCategoryBreakdown` sigue consumido** por el dashboard: es la fuente del devengado que alimenta "Gastaste" (1.3). No removerlo
- [x] 8.4 Confirmar que el donut sigue funcionando en Movimientos (`category-spending-overview-container.tsx`) y retirar `topCard` de `CommittedCurrency` si ya no tiene consumidores
- [x] 8.5 Limpiar las claves i18n que quedan huérfanas y agregar las nuevas de los cuatro bloques
- [x] 8.6 **Fix:** la limpieza de 8.5 se llevó `dashboard.spending.credits_label`, que la dona de Movimientos seguía consumiendo. Vuelve bajo `transactions.spending`, que es donde vive su único consumidor
- [x] 8.7 Test que escanea los fuentes y verifica que cada clave literal exista en `es` y en `en`, más la paridad entre los dos locales. El bug de 8.6 pasó tsc, ESLint y `next build`: solo aparecía al abrir la página

## 9. Verificación

- [x] 9.1 Correr los tests de `@grana/dashboard` y los del resto de los packages tocados
- [x] 9.2 Lint y typecheck del monorepo
- [ ] 9.3 Recorrer a mano los estados: usuario nuevo sin datos, mes sin ingresos (ritmo indeterminado), ritmo > 100%, sin tarjetas, sin gastos fijos, sin actividad compartida, usuario sin nada en USD, y compromisos con un resumen vencido
- [ ] 9.4 Verificar el eye toggle sobre **todos** los montos nuevos, incluidos los de los grupos desplegables y el pie de la tira de ritmo
- [ ] 9.5 Verificar que el selector de mes recalcula Resumen del mes y Cuánto gastaste, que **sí** mueve el saldo disponible (corte mensual) y que **no** toca Compromisos: su ventana es el próximo mes calendario respecto de hoy, fija
- [ ] 9.6 Revisión de accesibilidad: el foco de la zona de detalle de Compromisos (ida y vuelta), contraste sobre la zona oscura y áreas táctiles en mobile

## 10. Archivo (pre-merge, obligatorio)

- [ ] 10.1 Mover `openspec/changes/redesign-dashboard-home-v2/` a `openspec/changes/archive/YYYY-MM-DD-redesign-dashboard-home-v2/`
- [ ] 10.2 Aplicar los deltas sobre `openspec/specs/dashboard/spec.md` y `openspec/specs/spending-by-category/spec.md`, integrándolos en la sección plana `## Requirements` (el master no debe quedar con secciones de delta)
- [ ] 10.3 Actualizar el `Purpose` de las dos capabilities para reflejar la composición nueva y la superficie única del desglose por categoría
- [ ] 10.4 Actualizar `AGENTS.md` si el change cambia el estado de algún módulo de la tabla
- [ ] 10.5 Correr `pnpm openspec:check` — debe pasar antes del merge
