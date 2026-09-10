# Comparativo Mobills × Grana — Informe final consolidado

_Síntesis de dos análisis independientes (Codex + Claude), cruzados y **verificados contra el código de `main`** archivo por archivo, distinguiendo siempre las tres superficies: app nativa (N), web vista-mobile (WM) y web desktop (WD)._

_Escrito: 2026-08 (contra `main` post #32–#39, alta ya rediseñada). **Revisado: 2026-09-10 contra `main` #127** — ver "Vigencia" en el roadmap._

_Fuentes:_
- _55 capturas reales de Mobills en uso — **evidencia cruda, fuera del repo**: no se versionan (15,3 MB de binarios de una app de terceros) y la rama temporal que las alojó se borró. Las conclusiones derivadas viven acá y en los 4 artifacts de la sesión (privados de la cuenta claude.ai del autor):_
  - _Comparativa Grana vs Mobills — https://claude.ai/code/artifact/fe6c0d1d-1fe0-4081-aabd-7494a48ea1de_
  - _Checklist de campo (hands-on) — https://claude.ai/code/artifact/2aaad830-faae-4bde-b786-762c0905ceb6_
  - _Mobills × Grana (pantalla por pantalla) — https://claude.ai/code/artifact/6e83c685-33af-4dba-b754-75adac3cf586_
  - _Informe Final consolidado — https://claude.ai/code/artifact/9256bcc6-6207-4f48-937d-2a335aabf94e_
- _Listings públicos (App Store / Google Play)._
- _Código de Grana en `main`._
- _El relevamiento del módulo Movimientos (`docs/design/movements-module/`), que vive en la rama `chore/movements-module-survey` — **sin mergear** a `main`._

## Tesis

**Mobills de superficie, Grana de motor.** Mobills gana en *operar sin pensar*; Grana gana en *entender sin mentirse*. Grana no necesita copiar a Mobills en modelo ni en cantidad de features: necesita tomarle la **ergonomía de baja fricción** —abrir rápido, elegir intención rápido, registrar rápido, volver rápido— sin tocar la inteligencia contable. El motor de Grana es más fuerte; la superficie todavía puede sentirse más liviana.

Matiz central: **"Grana iguala o supera a Mobills al cargar un gasto" vale solo *dentro* del formulario.** Desde producto, el flujo empieza en el `+` y sigue después de guardar. Ahí —el punto de entrada y el "volver a registrar algo parecido"— es donde queda fricción por recortar.

## Estado verificado (acuerdo Codex + Claude)

- **Alta de gasto:** Grana ya está a la par o mejor *dentro del form*. Monto héroe + autofocus, chips frecuentes (categoría+subcategoría en 1 tap), tabs Gasto/Ingreso/Otros, cuenta oculta con una sola elegible, chips Hoy/Ayer; reintegro/compartir/repetir/cuotas como profundidad contextual. No hay que copiar el form de Mobills.
- **Alta de cuenta y tarjeta:** más simple o parejo. Cuenta sin selector de tipo innecesario (`type = 'bank'` fijo) y bimoneda por defecto; tarjeta con **2 fechas** (cierre + vencimiento), no 4.
- **Pagar resumen:** más pesado *porque modela más realidad argentina* (FX + impuesto de sellos + fechas del próximo ciclo). No sacar exactitud; escalonar la presentación.
- **Feed:** WM/WD ya tenían búsqueda + filtros ricos (`movement-filters.tsx`). El **feed nativo** no los tenía al escribir esto — **cerrado desde entonces** (ver Vigencia).
- **Settings minimal** (centavos · idioma · categorías, en N y WM): no es un problema en sí.
- **Features ausentes** al escribir esto (grep vacío en `apps/*`): alertas de vencimiento, tags, adjuntar comprobante, presupuestos por categoría, metas de ahorro, import/export, uso offline. _(Metas de ahorro se cerró después — ver Vigencia.)_

## Precisiones verificadas contra `main`

1. **El flujo empieza en el `+`.** `QuickAddFab.tsx` hace `router.push('/transactions/new')` directo a una pantalla genérica. Ahí hay taps para recortar (elegir intención antes de entrar al form). _(Reverificado 2026-09-10: sigue igual, sin cambios.)_
2. **El diagnóstico de "home de chequeo" NO está en `main`.** Al escribir esto vivía **untracked en el disco local**. Hoy (2026-09-10) ese material está en **branches sin mergear**: `chore/simplify-home-diagnosis`, `claude/grana-v3-ui-simplify-dux5m8` y `chore/movements-module-survey`. Mismo problema, distinto estado: para `main` —la memoria durable— sigue sin existir. **Acción pendiente: consolidar/mergear ese material.**
3. **"Pagar resumen" ya existe** en el detalle de tarjeta (`PayHeroCard.tsx` + `onPayApagar`). No es una feature a agregar: es hacerla **más accesible desde superficies anteriores** (dashboard, lista de tarjetas, hero mensual, pendientes).
4. **El progressive disclosure del alta ya está hecho** (reintegro/compartir/repetir como chips de activación contextuales, colapsados por defecto). Sale del P0: la simplificación pendiente está en el **punto de entrada** y en **flujos pesados** (pagar resumen), no en el alta común.

## Roadmap consolidado

Estado real de cada ítem: **[nuevo]** a construir · **[parcial]** ya empezado · **[hecho]** ya está.

### Vigencia — actualización 2026-09-10 (contra `main` #127)

El informe se escribió contra `main` post #32–#39. A tres semanas `main` está en #127 y parte del roadmap ya se cumplió. Se marca lo cerrado **sin borrarlo**, para que se vea qué avanzó:

- **✅ P0 · Búsqueda + filtros en feed nativo** — CERRADO: `add-mobile-feed-filters` (25-ago) + `unify-movement-search-fields` (27-ago).
- **✅ P2 · Metas de ahorro** — SHIPPED: módulo **Savings** (`add-savings-purpose` + `add-savings-set-aside` + `extract-savings-module`, 31-ago). Ojo con el distingo de P1 más abajo.
- **🟡 P0 · Home modo chequeo** — avanzó fuerte: `redesign-dashboard-home-v2` (21-ago) pasó el dashboard de 6 superficies a **4 cards** y bajó densidad (el "cuánto te queda por pagar" deja de esconderse). **Falta** el bloque "últimos movimientos".
- **🟡 P1 · Pendientes unificados + mini-resumen** — avanzó: paridad nativa de bloques (`close-native-recurrences-block-parity` + `close-native-reimbursements-block-parity`, 26-ago), `add-native-category-spending-overview` (27-ago), `month-summary-opens-by-concept` (8-sep), `spending-card-closes-with-net` (5-sep).
- **🟡 P1 · Detalle compacto** — parcial: `unify-detail-actions-in-topbar` (18-ago) unificó las acciones del detalle; la **fusión hero/tiles** (survey P1/DC-1) sigue sin mergear.
- **🔵 Sin cambios**: Quick Add Sheet · últimos movimientos + registrar similar · acciones rápidas de tarjeta · alertas de vencimiento · presupuestos blandos · pago progresivo · tags · adjuntar · import/export · modo viaje.

**El próximo paso recomendado (Quick Add Sheet) sigue vigente y sin tocar.**

### P0 — Ergonomía de entrada y chequeo (mayor ROI en taps)

- **[nuevo] Quick Add Sheet.** El `+` abre intención: `Gasto` · `Ingreso` · `Compra con tarjeta` · `Transferencia` · `Ajuste`. Cada opción entra al form preconfigurada (tab/tipo/cuenta). _Hoy el FAB empuja directo al form genérico (reverificado 2026-09-10)._
- **[parcial → avanzó] Home modo chequeo.** Arriba: disponible real · gastado del mes · próximo compromiso · últimos 3 movimientos. El resto baja. _`redesign-dashboard-home-v2` (21-ago) ya bajó densidad y fusionó a 4 cards; falta el bloque de "últimos movimientos"._
- **[nuevo] Últimos movimientos en Inicio + "registrar similar".** Repetir un movimiento reciente en 1 tap. Bomba de reducción de taps. _No existe; el home no muestra movimientos recientes._
- **[parcial] Acciones rápidas de tarjeta fuera del detalle.** `Nueva compra` + `Pagar resumen` desde dashboard/lista. _El detalle ya tiene la CTA "Pagar"; falta exponerla antes y una "Nueva compra" de primer nivel._
- **[✅ CERRADO 2026-09-10] Búsqueda + filtros en el feed nativo global.** _WM ya lo tenía; N no. Cerrado por `add-mobile-feed-filters` (25-ago) + `unify-movement-search-fields` (27-ago)._

> El "progressive disclosure del form" **sale del P0**: ya está resuelto con chips de activación contextuales.

### P1 — Claridad y avisos (cerrar lo que está a medias)

- **[nuevo] Alertas de vencimiento** (resumen a pagar, recurrencias pendientes, deuda vencida). _Grana ya tiene los datos (`CommittedSection` avisa deuda vencida); falta empujar el aviso (push/local)._
- **[nuevo] Presupuestos blandos por categoría.** No un planner complejo: barras simples ("Comida 72% del límite"). _**Ojo — no darlo por cerrado mirando el módulo Savings.** Savings (mergeado 31-ago) es **apartar plata en sobres** ("esto no lo voy a gastar"); esto es un **límite de gasto por categoría**. Son cosas distintas. Este ítem sigue abierto. La versión completa de la proyección/planificación es el módulo `cashflow` (futuro)._
- **[parcial] Detalle de movimiento compacto.** Menos duplicación hero/tiles. _`unify-detail-actions-in-topbar` (18-ago) unificó las acciones; la fusión hero/tiles (survey P1/DC-1) sigue sin mergear._
- **[nuevo] Pago de resumen progresivo.** Primero "qué pagás y desde dónde"; FX/sellos/próximo ciclo solo si aplican. _`add-multicurrency-statement-payment` (4-sep) sumó multimoneda al pago — más feature, no la simplificación progresiva._
- **[parcial → avanzó] Pendientes unificados + mini-resumen mensual en el feed.** _Bloques de pendientes con paridad nativa (26-ago) + `add-native-category-spending-overview` (27-ago) + `month-summary-opens-by-concept` (8-sep). Falta unificarlos y cerrar el header "entró/salió/diferencia"._

### P2 — Features nuevas (valor real, pero no primero)

- **[✅ SHIPPED 2026-09-10] Metas de ahorro** — módulo **Savings** (`add-savings-purpose` + `add-savings-set-aside` + `extract-savings-module`, 31-ago).
- **[nuevo]** Tags · Adjuntar comprobante · Import/Export (idealmente **import desde Mobills**, potente para adquisición) · Modo viaje (encaja con lo bimoneda).

## Preservar — el foso (no tocar)

- Bimoneda ARS/USD sin conversión automática.
- Tarjetas off-ledger + cuotas madre/hija.
- Corte temporal: el futuro es visible pero no se mezcla con "qué tengo".
- FX al **pagar** el resumen, no al consumir.
- Reintegros con % / tope / destino.
- Una sola app para todos, sin modo novato/experto.
- Copy pedagógico medido — sin convertir cada pantalla en explicación larga.

## Simplificar — mismo motor, menos peso

- **FAB:** de "abrir formulario" a "elegir intención".
- **Dashboard mobile:** bajar densidad inicial; la primera pantalla contesta una pregunta, no muestra todo el sistema. _(En marcha: `redesign-dashboard-home-v2`.)_
- **Pagar resumen:** en pasos / bloques progresivos.
- **Detalle:** resumen compacto arriba, tiles solo con info diferencial.
- **Estados visuales** (chips, barras, semáforos suaves) en vez de texto donde alcance.

## Qué NO copiar (dos "no" compartidos)

- **El "todo-app financiera"** (reportes, recibos, geoloc, premium, ads…): agranda la app sin hacerla más clara.
- **Interrupciones agresivas.** Confirmado en las capturas: Mobills mete interstitials ("Hola, te extraño", "Nuevo en el aire") y anuncios. Para Grana sería veneno — la app tiene que abrir rápido.
- **Home customizable: no-go por ahora.** Conviene una home *curada*; customizar cards esconde info crítica y suma configuración.
- **Llenar Settings para parecer maduro:** lo que falta son features (arriba), no densidad de menú.

## Anexo — Cómo Mobills proyecta (Realizado/Pendiente) y por qué Grana no lo copia

_Relevante para el futuro módulo `cashflow`. Verificado con las capturas (números reales)._

**Mobills sí proyecta, y el motor es un flag por transacción, no "Gasto fijo".**

- El dashboard muestra dos números por cuenta: **Saldo actual** vs **Saldo previsto**. Prueba con números reales: Billetera con saldo actual **$5.000.000,36** y saldo previsto **$4.910.000,36** — diferencia **exactamente $90.000**, que es un gasto de tarjeta fechado a futuro y todavía **pendiente**. Es decir: **previsto = actual − pendientes**.
- Cada transacción tiene un flag **Realizado / Pendiente** (toggle "Realizado" en el alta, viene prendido). **Realizado** (✓ verde en la lista) cuenta en el saldo actual; **Pendiente** (pin 📌 en la lista) cuenta solo en el previsto. La preferencia **"Efectivar automáticamente"** da vuelta el pendiente a realizado al vencer.
- **"Gasto fijo" y "Repetir" no son la proyección**: son los mecanismos que *generan* los items futuros pendientes que después alimentan el previsto. "Gasto fijo" ≠ una feature separada de recurrencia — es la cara de "esto se repite/es fijo".

**Grana llega al mismo lugar por otro camino, más limpio — y es el foso:**

- Grana **no** pone un flag pendiente/realizado en cada movimiento (eso mezclaría lo que pasó con lo que va a pasar dentro del mismo libro). Lo esperado vive **fuera del ledger** como **instancias de recurrencia pendientes** (que se confirman) y se muestra como **"Compromisos futuros"** en el dashboard (deuda de tarjeta + recurrentes).
- Mobills funde presente y futuro en un solo número ("saldo previsto"). Grana los mantiene **separados** (corte temporal): "lo que tengo hoy" nunca se contamina con "lo que se viene".

**Implicación para `cashflow`:**

- **No** traer el flag Realizado/Pendiente por transacción — rompe el corte temporal.
- **Sí** puede tener valor un "previsto" **derivado** (`saldo actual − compromisos del mes`) mostrado **aparte** del saldo actual, nunca fundido con él. Grana ya calcula los compromisos; falta —si se decide— exponerlos como un glance de proyección. Esa es la versión Grana-correcta del "saldo previsto" de Mobills.

## Método y confiabilidad

Grana mapeado del código en `main` —no de memoria—, verificado archivo por archivo separando WM de N (la confusión web↔nativo fue el único error detectado y corregido en el proceso). Reverificado contra `main` #127 el 2026-09-10. Mobills, de una tanda única de 55 capturas reales. Cruzado con el análisis de Codex (listings públicos + repo local). Referencias al relevamiento del módulo Movimientos (rama `chore/movements-module-survey`, sin mergear) para no reabrir decisiones ya cerradas.

**Pendiente de confirmar en Mobills:** control de deudas/préstamos y el detalle del flujo de presupuestos.

## Próximo paso recomendado

**Quick Add Sheet** (P0, mayor ROI): el `+` pasa de abrir un form genérico a elegir intención, sin tocar el motor contable. Relevar taps actuales vs propuestos y dejarlo como change de OpenSpec sobre `main` actualizado.
