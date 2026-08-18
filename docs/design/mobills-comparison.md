# Comparativo Mobills × Grana — Informe final consolidado

_Síntesis de dos análisis independientes (Codex + Claude), cruzados y **verificados contra el código de `main`** archivo por archivo, distinguiendo siempre las tres superficies: app nativa (N), web vista-mobile (WM) y web desktop (WD)._

_Fecha: 2026-08. Fuentes: 55 capturas reales de Mobills en uso (tanda temporal, rama `chore/mobills-reference-screenshots`) + listings públicos (App Store / Google Play) + código de Grana en `main` (post #32–#39, alta ya rediseñada) + el relevamiento activo `docs/design/movements-module/`._

## Tesis

**Mobills de superficie, Grana de motor.** Mobills gana en *operar sin pensar*; Grana gana en *entender sin mentirse*. Grana no necesita copiar a Mobills en modelo ni en cantidad de features: necesita tomarle la **ergonomía de baja fricción** —abrir rápido, elegir intención rápido, registrar rápido, volver rápido— sin tocar la inteligencia contable. El motor de Grana es más fuerte; la superficie todavía puede sentirse más liviana.

Matiz central: **"Grana iguala o supera a Mobills al cargar un gasto" vale solo *dentro* del formulario.** Desde producto, el flujo empieza en el `+` y sigue después de guardar. Ahí —el punto de entrada y el "volver a registrar algo parecido"— es donde queda fricción por recortar.

## Estado verificado (acuerdo Codex + Claude)

- **Alta de gasto:** Grana ya está a la par o mejor *dentro del form*. Monto héroe + autofocus, chips frecuentes (categoría+subcategoría en 1 tap), tabs Gasto/Ingreso/Otros, cuenta oculta con una sola elegible, chips Hoy/Ayer; reintegro/compartir/repetir/cuotas como profundidad contextual. No hay que copiar el form de Mobills.
- **Alta de cuenta y tarjeta:** más simple o parejo. Cuenta sin selector de tipo innecesario (`type = 'bank'` fijo) y bimoneda por defecto; tarjeta con **2 fechas** (cierre + vencimiento), no 4.
- **Pagar resumen:** más pesado *porque modela más realidad argentina* (FX + impuesto de sellos + fechas del próximo ciclo). No sacar exactitud; escalonar la presentación.
- **Feed nativo:** brecha real. WM/WD ya tienen búsqueda + filtros ricos (`movement-filters.tsx`, montado en el feed); el **feed nativo global** todavía no (solo navegación por mes). Ya decidido en el survey (paridad N≡WM, P2/D-001).
- **Settings minimal** (centavos · idioma · categorías, en N y WM): no es un problema en sí.
- **Features ausentes confirmadas** (grep vacío en `apps/*`): alertas de vencimiento, tags, adjuntar comprobante, presupuestos por categoría, metas de ahorro, import/export, uso offline.

## Precisiones verificadas contra `main`

1. **El flujo empieza en el `+`.** `QuickAddFab.tsx` hoy hace `router.push('/transactions/new')` directo a una pantalla genérica. Ahí hay taps para recortar (elegir intención antes de entrar al form).
2. **El diagnóstico de "home de chequeo" NO está en el repo.** `PROPUESTA-INICIO-2026-07-31.md`, `apps/web/prototypes/` y `docs/design/simplify-home/` existen **localmente pero untracked** (no están en `main` ni en ninguna rama remota). Para una sesión futura, "no existen". **Acción pendiente: commitearlos** desde el entorno local.
3. **"Pagar resumen" ya existe** en el detalle de tarjeta (`PayHeroCard.tsx` + `onPayApagar`). No es una feature a agregar: es hacerla **más accesible desde superficies anteriores** (dashboard, lista de tarjetas, hero mensual, pendientes).
4. **El progressive disclosure del alta ya está hecho** (reintegro/compartir/repetir como chips de activación contextuales, colapsados por defecto). Sale del P0: la simplificación pendiente está en el **punto de entrada** y en **flujos pesados** (pagar resumen), no en el alta común.

## Roadmap consolidado

Estado real de cada ítem: **[nuevo]** a construir · **[parcial]** ya empezado · **[hecho]** ya está.

### P0 — Ergonomía de entrada y chequeo (mayor ROI en taps)

- **[nuevo] Quick Add Sheet.** El `+` abre intención: `Gasto` · `Ingreso` · `Compra con tarjeta` · `Transferencia` · `Ajuste`. Cada opción entra al form preconfigurada (tab/tipo/cuenta). _Hoy el FAB empuja directo al form genérico._
- **[parcial] Home modo chequeo.** Arriba: disponible real · gastado del mes · próximo compromiso · últimos 3 movimientos. El resto baja. _El dashboard hoy es denso; hay diagnóstico local sin commitear (ver precisión 2)._
- **[nuevo] Últimos movimientos en Inicio + "registrar similar".** Repetir un movimiento reciente en 1 tap. Bomba de reducción de taps. _No existe; el home no muestra movimientos recientes._
- **[parcial] Acciones rápidas de tarjeta fuera del detalle.** `Nueva compra` + `Pagar resumen` desde dashboard/lista. _El detalle ya tiene la CTA "Pagar"; falta exponerla antes y una "Nueva compra" de primer nivel._
- **[parcial] Búsqueda + filtros en el feed nativo global.** _WM ya lo tiene; N no. Decidido en el survey (P2)._

> El "progressive disclosure del form" **sale del P0**: ya está resuelto con chips de activación contextuales.

### P1 — Claridad y avisos (cerrar lo que está a medias)

- **[nuevo] Alertas de vencimiento** (resumen a pagar, recurrencias pendientes, deuda vencida). _Grana ya tiene los datos (`CommittedSection` avisa deuda vencida); falta empujar el aviso (push/local)._
- **[nuevo] Presupuestos blandos por categoría.** No un planner complejo: barras simples ("Comida 72% del límite"). _En roadmap (`savings`/`cashflow`)._
- **[parcial] Detalle de movimiento compacto.** Menos duplicación hero/tiles. _Handoff cerrado en el survey (P1/DC-1), no mergeado._
- **[nuevo] Pago de resumen progresivo.** Primero "qué pagás y desde dónde"; FX/sellos/próximo ciclo solo si aplican.
- **[parcial] Pendientes unificados + mini-resumen mensual en el feed.** _Ya hay bloques de pendientes (recurrencias, reintegros) y overview de categoría en web; falta unificar y el header "entró/salió/diferencia" en nativo._

### P2 — Features nuevas (valor real, pero no primero)

- **[nuevo]** Tags · Adjuntar comprobante · Import/Export (idealmente **import desde Mobills**, potente para adquisición) · Metas de ahorro · Modo viaje (encaja con lo bimoneda).

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
- **Dashboard mobile:** bajar densidad inicial; la primera pantalla contesta una pregunta, no muestra todo el sistema.
- **Pagar resumen:** en pasos / bloques progresivos.
- **Detalle:** resumen compacto arriba, tiles solo con info diferencial.
- **Estados visuales** (chips, barras, semáforos suaves) en vez de texto donde alcance.

## Qué NO copiar (dos "no" compartidos)

- **El "todo-app financiera"** (reportes, recibos, geoloc, premium, ads…): agranda la app sin hacerla más clara.
- **Interrupciones agresivas.** Confirmado en las capturas: Mobills mete interstitials ("Hola, te extraño", "Nuevo en el aire") y anuncios. Para Grana sería veneno — la app tiene que abrir rápido.
- **Home customizable: no-go por ahora.** Conviene una home *curada*; customizar cards esconde info crítica y suma configuración.
- **Llenar Settings para parecer maduro:** lo que falta son features (arriba), no densidad de menú.

## Método y confiabilidad

Grana mapeado del código en `main` —no de memoria—, verificado archivo por archivo separando WM de N (la confusión web↔nativo fue el único error detectado y corregido en el proceso). Mobills, de una tanda única de 55 capturas reales. Cruzado con el análisis de Codex (listings públicos + repo local). Referencias al survey activo `docs/design/movements-module/` para no reabrir decisiones ya cerradas.

**Pendiente de confirmar en Mobills:** control de deudas/préstamos y el detalle del flujo de presupuestos.

## Próximo paso recomendado

**Quick Add Sheet** (P0, mayor ROI): el `+` pasa de abrir un form genérico a elegir intención, sin tocar el motor contable. Relevar taps actuales vs propuestos y dejarlo como change de OpenSpec sobre `main` actualizado.
