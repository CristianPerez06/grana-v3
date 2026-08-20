## Why

El dashboard actual reparte la respuesta en **seis superficies**, dos de ellas condicionales: Hero "Para gastar · hoy" + card "Dónde está" (fila 1), "Balance del mes" + "Comprometido" (fila 2), la tira "Compartido", la barra "Gastaste este mes" y la dona "En qué se fue". El handoff de diseño (`docs/design/dashboard-home/`) reorganiza esa misma información en **cuatro bloques**. No es un reacomodo estético: cada fusión y cada baja corrige un problema concreto del layout vigente.

- **"Dónde está" es una card aparte del Hero cuando responde la misma pregunta.** El Hero da el total y la card de al lado dice dónde está ese total: dos cards para una sola lectura. El handoff pliega el desglose **adentro** del hero oscuro, con las dos cuentas principales de cada moneda enfrentadas (ARS a la izquierda, USD a la derecha) y sin barras de proporción — el porcentaje alcanza.

- **El número más accionable se esconde detrás de una condición.** `SpentThisMonthSection` (`apps/web/app/(app)/dashboard/_components/spent-this-month-section.tsx:44`) hace `if (financed <= 0) return null`: lo que te queda por pagar desaparece justo cuando no hay deuda de tarjeta, que es cuando el usuario querría verlo en cero y quedarse tranquilo. Y cuando sí renderiza, lo hace como una barra proporcional de dos segmentos sin nombre propio para cada monto. El handoff lo promueve a card de primer nivel con **tres tiles rotulados** (Gastaste / Pagaste / Te queda por pagar).

- **No hay noción de ritmo.** El dashboard muestra un gasto absoluto sin nada contra qué compararlo: `$ 441.273` no dice si vas bien o mal. El handoff agrega la tira de ritmo con anillo, que pone el gasto del mes contra los ingresos del mes.

- **"Comprometido" lista consumos sueltos, no tarjetas.** `CommittedCurrency.topCard` es *"Top card consumos of the 'A pagar' set, by amount desc"* (`packages/dashboard/src/types.ts:125`): movimientos individuales. El usuario no puede leer "cuánto me viene de Visa". El handoff reagrupa **por tarjeta**, con su próximo cierre en la bajada.

- **"En qué se fue" duplica la portada de Movimientos.** El mismo desglose por categoría ya es la carta de presentación del módulo (`apps/web/app/(app)/transactions/_components/category-spending-overview-container.tsx`), con navegación por mes y drill-down. Tenerlo dos veces alarga el dashboard sin agregar respuesta.

## What Changes

- **Card 1 — "Saldo disponible total".** Se fusionan Hero + "Dónde está" + el resumen mensual en **una sola card** de dos zonas: zona oscura (`#142231`) con el saldo, la fila USD y el bloque "Dónde está" con las dos cuentas principales por moneda y sus porcentajes; y zona clara con "Resumen del mes" en **tres columnas**: Tenías (el saldo con el que se entró al mes), Entró y Se fué. Baja la barra apilada de ingresos/gastos y la fila "Ajustes" de la actual "Balance del mes".

  La card entera **sigue al selector de mes**: el saldo se corta al último día del mes seleccionado, y cuando no es el mes corriente el rótulo lo dice. Eso es lo que hace que los tres montos cierren contra el saldo de arriba y que la card se pueda auditar en pantalla:

  ```
  Tenías + Entró − Se fué  ===  el saldo que muestra la card
  ```

  "Entró" y "Se fué" son una lectura de **liquidez**: todo movimiento que tocó el saldo cae de un lado o del otro según su signo, ajustes, liquidaciones y cambio de moneda incluidos.

- **Card 2 — "Cuánto gastaste".** `SpentThisMonthSection` deja de ser condicional y de ser una barra: pasa a tres tiles con ícono, filete de color y sub-bloque de contexto. Los tres montos **ya se calculan hoy** con esa misma semántica (`accrued` → Gastaste, `cash` → Pagaste, `accrued − cash` → Te queda por pagar) y reconcilian por construcción; lo nuevo es el lado USD y el ritmo. Debajo, la **tira de ritmo con anillo**: `Gastaste / ingresos acreditados del mes` — no contra el "Entró" de liquidez, que incluye reintegros y patas de cambio de moneda y inflaría el denominador.

- **Card 3 — "Compromisos del próximo mes".** El total gana una **barra apilada** Tarjetas / Gastos fijos con leyenda y porcentajes derivados, y los dos detalles pasan a **grupos desplegables**: Tarjetas agrupadas **por tarjeta** (no por consumo) mostrando hasta 3 con el resto detrás del toggle, y Gastos fijos con hasta 10 filas, scroll interno y link al listado completo.

- **Card 4 — "Compartido".** La tira se mantiene y **se extiende a mobile**, donde hoy no existe (`apps/mobile/components/dashboard/` no tiene ningún `SharedStrip`). Sigue renderizando solo con actividad.

- **Baja del dashboard la sección "En qué se fue"** (dona + leyenda + créditos por categoría + toggle ARS/USD), en las dos plataformas. La capability `spending-by-category` **no se elimina**: conserva su superficie principal en Movimientos. El dashboard sigue consumiendo `getMonthCategoryBreakdown` porque de ahí sale el devengado que alimenta "Gastaste".

- **El saldo pasa a ser histórico.** `getDashboardHero` recibe una fecha de corte (la RPC `get_account_balance_sums` ya la tomaba como parámetro, así que no cambia SQL), y `aggregateHero` empieza a respetar `initial_balance_date`: una cuenta creada en julio no aporta su saldo inicial al saldo del 31 de mayo. Sin eso, los meses viejos mostraban plata que el usuario todavía no tenía.

- **Regla bimoneda explícita.** ARS y USD siguen **sin sumarse ni convertirse** — se respeta la invariante vigente (`packages/dashboard/src/types.ts:137`: *"ARS and USD are never summed"*). Cada métrica muestra su valor ARS como titular y su valor USD debajo, y **la línea USD se renderiza solo cuando ese valor es distinto de cero**. No se introduce tipo de cambio global.

- **Accesibilidad de los desplegables.** Las cabeceras de los grupos de Compromisos son `<button>` con `aria-expanded` y `aria-controls` apuntando al panel, con área táctil ≥44px en mobile.

- **Estados cubiertos explícitamente**: sin ingresos del mes (el ritmo no se puede calcular → mensaje en lugar de anillo), ritmo > 100% (anillo y barra en terracota, copy ajustado), sin tarjetas, sin gastos fijos, sin actividad compartida (no se renderiza la tira), carga (skeletons shape-matched) y error de fetch por sección.

## Capabilities

### Modified Capabilities

- `dashboard`: se redefine la composición de la pantalla (de seis superficies a cuatro bloques), se fusionan Hero + "Dónde está" + resumen mensual en una card, "Balance del mes" se reduce a "Resumen del mes" (Entró / Se fué), la barra condicional "Gastaste este mes" se promueve a la card "Cuánto gastaste" con tres tiles y ritmo, "Comprometido" reagrupa su detalle por tarjeta y expone sus grupos como desplegables accesibles, la tira "Compartido" se extiende a mobile, y se retira la sección "En qué se fue" de la pantalla. Se enuncia la regla bimoneda de render (USD visible solo si ≠ 0) y los estados de ritmo indeterminado y ritmo > 100%.
- `spending-by-category`: se retira la superficie del dashboard de la capability; el desglose por categoría queda con una sola superficie, la portada del módulo Movimientos.

## Impact

- **Package compartido** (`packages/dashboard`): `getCommittedOutlook` cambia la forma del detalle — de top consumos sueltos a **agregado por tarjeta** con próximo cierre. Se agrega el conteo de compras pendientes que alimenta el copy del tile "Te queda por pagar", y la derivación del ritmo como función pura testeable. `aggregateHero` gana la selección de las **dos** cuentas top por moneda con su porcentaje sobre el total de esa moneda.
- **Web** (`apps/web/app/(app)/dashboard/_components/`): se reescribe `dashboard-content.tsx` (nueva grilla: fila 1 a ancho completo, fila 2 `1fr / 1.12fr` con cards de igual altura, pie Compartido). `hero-section` + `accounts-card` + `month-balance-section` se fusionan; `spent-this-month-section` se reescribe; `committed-section` se reestructura. Se dan de baja `spending-section`, `spending-section-container`, `spending-donut`, `spending-skeleton` y sus stories **del dashboard** (el donut sigue vivo en Movimientos).
- **Mobile** (`apps/mobile/components/dashboard/`): mismo movimiento con naming espejo en PascalCase, más el `SharedStrip` que hoy no existe. `apps/mobile/app/(app)/dashboard.tsx` recompone las secciones.
- **Base de datos**: **ninguna migración**. Las tres decisiones de producto (monedas separadas, sin TC global, ritmo sobre ingresos reales del mes) se resolvieron justamente para que este change no toque el schema ni agregue configuración de usuario.
- **i18n**: nuevas claves bajo `dashboard.*` para los rótulos, los copys de los sub-bloques y los estados vacíos; bajan las de la sección retirada.
- **Riesgo**: medio-alto por **superficie**, bajo por **semántica**. Los números no cambian de definición: los tres montos de "Cuánto gastaste" ya se calculan con esa fórmula y ya reconcilian, y el total comprometido ya existe. Lo que cambia es cómo se agrupan, se rotulan y se muestran. El punto de mayor cuidado es la agregación por tarjeta, que sí es forma de dato nueva.
- **Fuera de alcance**: el módulo Movimientos y su desglose por categoría (no se toca, solo deja de espejarse en el dashboard); `/cards` y `/shared` como destinos de los links; el selector de mes y el eye toggle, que conservan su comportamiento actual; y cualquier configuración de usuario nueva (ingreso esperado, tipo de cambio) — descartadas por decisión de producto.
