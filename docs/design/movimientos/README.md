# Diseño · Módulo Movimientos

Exports de Paper del rediseño del módulo Movimientos (`/transactions`, capability `transactions`), iterados durante mayo 2026.

## Origen

- **Archivo Paper**: "Witty moon" (team de Julieta).
- **Workflow**: pintado iterativamente desde Claude Code usando el MCP de Paper. Cada artboard se discutió, pintó, screenshot review, y ajustó en el mismo turno de chat.
- **Exportación**: manual desde la UI de paper.design (Export → PNG @1x). El MCP también soporta export programático (`mcp__paper__export` / `mcp__paper__export_combined_pdf`) si se quiere automatizar a futuro.

## Estado

12 artboards desktop 1440px. 11 completos, 1 parcial (el 12).

| # | PNG | Qué muestra | Estado |
|---|---|---|---|
| 01 | `01-lista-principal.png` | Pantalla `/transactions` completa: header narrativo Mayo 2026, banner de sugerencia de recurrencia, barra de búsqueda + filtros + chips, 3 day groups con filas variadas (gasto, ingreso, suscripción USD, compra en cuotas, transferencia, cambio USD, reintegro pendiente, pago resumen, ajuste), FAB. | ✅ |
| 02 | `02-filtros-sheet.png` | Variante con el sheet de filtros desplegado desde la derecha: tipo (chips), categoría, cuenta, moneda (segmented), rango de monto, footer con conteo. | ✅ |
| 03 | `03-vista-cuenta.png` | Pantalla `/accounts/[id]` con `AccountDetailHeader` (avatar + balances ARS/USD), búsqueda en cuenta, day groups con **running balance** por fila y saldo del día. | ✅ |
| 04 | `04-detalle-movimiento.png` | Detalle de movimiento (compra en cuotas como caso complejo): hero card con tipo en chips + monto display terracotta + meta grid de 2 columnas + tabla de cuotas con números circulares y badges + acciones Editar/Duplicar/Eliminar. | ✅ |
| 05 | `05-nuevo-movimiento.png` | Form único `/transactions/new`: tipos como chips segmentados, card de monto independiente con switcher ARS/USD (display 64px), hint pedagógico bajo descripción ("La última vez lo categorizaste como…"), cuotas como segmented. | ✅ |
| 06 | `06-editar-movimiento.png` | El mismo form en modo edit: bloque BLOQUEADO con tipo/moneda/tarjeta/cuotas inmutables, monto muteado, solo descripción/categoría/cuenta/fecha editables. | ✅ |
| 07 | `07-empty-states.png` | 3 variantes lado a lado: sin movimientos (emerald, CTA "Registrar el primero"), búsqueda vacía (slate, CTA "Limpiar búsqueda"), filtros muy estrictos (warning, CTAs "Quitar filtros" / "Ajustar filtros"). Copy editorial cálido. | ✅ |
| 08 | `08-breakdown-variantes.png` | 3 variantes del componente "En qué se fue" (CategorySpendingOverview): **A** donut grande + ranking lateral, **B** ranking tipográfico sin donut, **C** donut compacto + top 3. Para decidir cuál usar en `/transactions`. | ✅ |
| 09 | `09-transactions-variante-b.png` | `/transactions` completo con la variante B embebida. | ✅ |
| 10 | `10-transactions-variante-a.png` | `/transactions` completo con la variante A embebida. | ✅ |
| 11 | `11-transactions-variante-c.png` | `/transactions` completo con la variante C embebida. | ✅ |
| 12 | `12-hibrido-parcial.png` | **PARCIAL** — `/transactions` con el híbrido elegido (donut grande de A + meta enriquecida de C) y **header limpio sin CTAs primary arriba**. Falta abajo: filter bar + day groups. | ⚠️ |

## Decisiones de diseño tomadas

Decisiones que NO se pueden romper en iteraciones futuras:

1. **Header limpio**: sin botones CTA arriba a la derecha. El FAB navy abajo cubre "Registrar movimiento" (es el patrón canónico en código vía `QuickAddFab`); "Recurrencias" ya está en el sidebar. Tenerlos duplicados en el header le pelea atención al display "Mayo 2026".
2. **Variante final del breakdown**: **híbrido entre A y C** = donut grande 200px + ranking lateral con meta enriquecida ("40% · 8 movimientos", "25% · cuotas Sofá Sofías", "11% · 3 recurrentes"). Justificación: el research (ver abajo) muestra que el donut funciona como hook pero solo si la lista al lado da contexto suficiente.
3. **Color semántico editorial**: gastos en **terracotta `#B56A5A`** (token existente del repo), NO `text-red-600` crudo. Income en emerald `#10B981`. Transfer / exchange / ajuste positivo / pago resumen tarjeta en navy `#0B1A2B` neutro.
4. **Recurrencia como chip** con label `🔄 Recurrente` en slate suave (bg `rgba(58,107,138,0.12)`, text `#3A6B8A`), aplicado a **todas** las filas que apliquen para que se lea como patrón. Validado por research YNAB (treatment "thundercloud gray" para scheduled transactions).
5. **Off-ledger explícito**: el card de "En qué se fue" termina con "Sin contar consumos en tarjeta sin pagar". Refuerza el principio de la app (consumos con tarjeta NO bajan el disponible hasta que se paga el resumen). Aplica el insight del research YNAB ("Achilles' heel" del manejo de tarjetas).
6. **Bimoneda con switcher ARS/USD** en el header del card de breakdown. NO traer el "wallet balance" único de Spendee — choca con el principio bimoneda.
7. **Donut estático**. NO animaciones decorativas (research: a Spendee le pegan por "excessive animations and layers").
8. **Ancho de contenido**: `max-width: 1040px`. Más que el `max-w-3xl` (768px) actual del código pero menos que full-bleed, para dejar respirar el running balance en la vista de cuenta sin que la pantalla principal se sienta "vacía".

## Design system (tokens literales)

Tomado de `packages/ui-tokens/src/theme.css` y las pantallas de dashboard / login ya exportadas a código por el tech lead. Es el baseline que respeta todo el diseño.

```css
/* Superficies */
--page-bg: #F6F7F9;
--card-bg: #FFFFFF;

/* Texto */
--ink: #0B1A2B;          /* navy primario */
--text-muted: #6B7683;
--text-soft: #8A94A3;

/* Bordes */
--border: #E6EAEF;
--border-soft: #EEF1F4;

/* Semánticos */
--emerald: #10B981;      /* income, positivo */
--terracotta: #B56A5A;   /* expense */
--slate: #3A6B8A;        /* info, recurrencia */
--warning: #8B6E1C;      /* + bg rgba(196,154,60,0.18) */

/* Categorías (donut + ranking) */
cat-1: #10B981 (emerald);
cat-2: #0D9488 (teal);
cat-3: #3A6B8A (slate);
cat-4: #B56A5A (terracotta);
cat-5: #8A6E98 (plum);

/* Tipografía: Plus Jakarta Sans */
display monto:   36-48px / 700 / tracking -0.025em
page title:      24-32px / 700 / tracking -0.025em
section title:   18px / 700 / tracking -0.015em
body bold:       14-15px / 600
body:            14px / 500
caption:         12px / 500
eyebrow caps:    11-12px / 600 / uppercase / tracking 0.06-0.08em
todo monto:      font-variant-numeric: tabular-nums

/* Radii */
button/input:    12px
card:            14-18px
pill/chip:       9999px

/* Shadow FAB */
0 8px 32px rgba(11,26,43,0.18),
0 4px 8px rgba(11,26,43,0.10)
```

## Research aplicado

Insights de un research que el agente hizo en sesión sobre Mobills, Spendee, YNAB, Splitwise y Splid (reseñas de App Store / Google Play / Reddit r/personalfinance / case studies de UX). Los que se aplicaron al diseño:

- **Spendee** acertó con el donut % por categoría como hook visual; los users le pegan por "excessive animations and layers". → Donut sí, estático.
- **YNAB** pinta scheduled transactions en "gentle thundercloud gray" anclado arriba del register, y los users castigan el manejo de credit cards ("Achilles' heel"). → Chip dedicado para recurrencias + off-ledger explícito.
- **Splid** se quemó por no mostrar fecha por expense ("each expense should have the date of the expense"). → Agrupación por día con fecha clara siempre visible.
- **Splitwise**: lista plana sin agrupación = anti-pattern probado. → Day groups con borders y separadores.
- **Mobills**: filtros sólidos (cuenta, categoría, tag) son lo más alabado, pero sus running balances rotos son anti-pattern. → Filtros como first-class + cero margen para saldos que no cuadran.

## Patrones que se decidió NO traer

- YNAB tabla densa estilo planilla (incompatible con el tono editorial cálido de grana).
- Splitwise log plano sin agrupación.
- Spendee "wallet balance" único arriba (choca con bimoneda).
- Mobills cuatro-estados-mezclados (paid|pending|recurring|repeated) sin separar "es recurrente" de "está pagado".
- Splid sin fecha por fila.

## Pendiente y siguiente paso

El artboard 12 (híbrido) quedó parcial porque chocamos el **límite semanal del MCP de Paper** (resetea cada lunes aprox). Falta agregar abajo del card híbrido: la **filter bar compacta** y los **day groups** (Hoy con 3 movimientos, Ayer con 4 movimientos).

**Plan para terminarlo sin esperar al reset**:

1. Pasarlo a "Claude Design" (claude.ai con artifacts) — ver el prompt completo en el apéndice de abajo.
2. Claude Design genera el artboard 12 completo como HTML standalone con inline styles.
3. Cuando el MCP de Paper se libere, retomar en Claude Code: pegarle el HTML y pedirle que traslade el HTML a nodes de Paper en el artboard 12.
4. Re-exportar el artboard 12 actualizado como PNG, sobrescribir `12-hibrido-parcial.png` (renombrar a `12-hibrido-final.png`), commitear.

## Trabajo futuro decidido pero no empezado

1. **Mobile espejado**: artboards 390×844 para las 12 pantallas. CLAUDE.md/AGENTS.md exigen paridad mobile (props compartidos via `@grana/ui-contracts`). Mobile usa la misma paleta + tipografía; ajusta padding y reduce display monto a 28-32px.
2. **Banners completos**: `PendingRecurrencesBlock` y `PendingReimbursementsBlock` con detalle expandido. En el artboard 01 sólo está `RecurrenceSuggestionBanner` resumido.
3. **Estados del híbrido**: variantes en USD (switcher activado), mes sin gastos, mes con 1 sola categoría, mes con 12+ categorías. Para validar que el diseño aguanta todos los casos.

---

## Apéndice: prompt para Claude Design

Para reutilización futura, o si querés pedirle a Claude Design un re-render del artboard 12 con ajustes.

**Workflow operativo**:

1. Abrir claude.ai y crear conversación nueva.
2. Adjuntar al input los PNGs `01-lista-principal.png` y `12-hibrido-parcial.png` (mínimo). Opcional: `08-breakdown-variantes.png` y `04-detalle-movimiento.png`.
3. Pegar el prompt completo (abajo).
4. Esperar el HTML.
5. Guardar el output como `12-hibrido-final.html` en esta misma carpeta.

**Prompt**:

> Sos diseñador continuando un trabajo de Paper que no podés abrir. Te paso screenshots del estado actual + el contexto completo. Tu output: HTML+CSS standalone (un solo archivo, inline styles, listo para abrir en browser) que termine el artboard 12.
>
> ### Imágenes adjuntas
>
> - **artboard-01.png**: Lista principal completa de `/transactions`. Te muestra el patrón de header narrativo (descartado en favor del header limpio), de banners, de filter bar, de day groups con filas variadas.
> - **artboard-12-parcial.png**: Estado actual del híbrido. Tiene pintado: sidebar, header limpio sin CTAs, recurrence banner, card "En qué se fue" con donut 200px + ranking enriquecido, FAB navy. **FALTA**: filter bar y day groups.
> - **(opcional) artboard-08.png**: Las 3 variantes de breakdown (A donut+ranking, B tipográfico, C compacto) para que veas de dónde sale el híbrido elegido.
>
> ### Contexto del producto (no romper)
>
> Grana = app de finanzas personales argentina, bimoneda.
>
> - Bimoneda ARS+USD: nunca se suman. Totales separados por moneda. Switcher ARS/USD donde aplique.
> - Off-ledger tarjetas: consumos con tarjeta de crédito NO bajan el "disponible" hasta que se paga el resumen.
> - Cuotas: 1 madre + N hijas con estado pendiente/paga.
> - Reintegros: pendiente vs recibido son estados distintos; pendientes no entran a saldo.
> - Recurrencias visibles con chip `🔄 Recurrente` slate.
> - Tono: "no es banco, no es planilla. Sugiere y enseña."
>
> ### Design system (literal)
>
> Fuente: Plus Jakarta Sans (400-700, cargá desde Google Fonts).
> Page bg: `#F6F7F9`. Card bg: `#FFFFFF`.
> Ink primario: `#0B1A2B` (navy). Muted: `#6B7683`. Soft: `#8A94A3`.
> Border: `#E6EAEF`. Border soft: `#EEF1F4`.
> Emerald (income/positivo): `#10B981`.
> Terracotta (expense): `#B56A5A`. NO usar red crudo.
> Slate (info, recurrencia): `#3A6B8A`.
> Warning: `#8B6E1C` sobre bg `rgba(196,154,60,0.18)`.
> Categorías donut: `#10B981`, `#0D9488`, `#3A6B8A`, `#B56A5A`, `#8A6E98`.
>
> Tipografía:
>
> - Display monto: 36-48px / 700 / tracking -0.025em
> - Page title: 24-32px / 700 / tracking -0.025em
> - Section: 18px / 700 / tracking -0.015em
> - Body bold: 14-15px / 600
> - Body: 14px / 500
> - Caption: 12px / 500
> - Eyebrow caps: 11-12px / 600 / uppercase / tracking 0.08em
> - TODO monto: `font-variant-numeric: tabular-nums`
>
> Radii: button/input 12px. Card 14-18px. Pill 9999px.
> Shadow FAB: `0 8px 32px rgba(11,26,43,0.18), 0 4px 8px rgba(11,26,43,0.10)`.
>
> ### Decisiones del diseñador anterior (NO desviar)
>
> 1. Header limpio: solo eyebrow MOVIMIENTOS + nav "‹ Mayo 2026 ›" + subtítulo "28 movimientos · ARS y USD". SIN botones primary arriba (los anteriores estaban redundantes con el FAB).
> 2. Variante elegida del breakdown: **híbrido** = donut grande 200px + ranking lateral con meta **enriquecida** ("40% · 8 movimientos", "25% · cuotas Sofá Sofías", "11% · 3 recurrentes", "9% · transporte, salud, otros").
> 3. Donut estático, sin animación.
> 4. Color semántico: terracotta `#B56A5A` para gastos, emerald `#10B981` para income, navy `#0B1A2B` para neutro (transfers, exchanges).
> 5. Off-ledger explícito en footer del card: "Sin contar consumos en tarjeta sin pagar".
> 6. Recurrencia como chip slate con label `🔄 Recurrente`, aplicado a TODAS las filas que apliquen.
> 7. Ancho de contenido: `max-width: 1040px`.
>
> ### Tarea concreta
>
> Generá UN SOLO archivo HTML standalone con inline styles que reproduzca el artboard 12 COMPLETO (todo lo del screenshot parcial + lo que falta). Estructura:
>
> **App layout**:
>
> - Sidebar 240px ancho, bg blanco, border-right. Items: Inicio, Movimientos (activo, bg navy texto blanco), Cuentas, Tarjetas, Categorías, Recurrencias. Brand "grana" arriba con cuadrado emerald. User card abajo con avatar CA + nombre Cristian.
> - Main content padding 40 56px. Content max-width 1040px.
>
> **Contenido del main** (en orden, gap 24px entre bloques):
>
> 1. **Header limpio**: eyebrow "MOVIMIENTOS" + flex de botón ‹ 36px + h1 "Mayo 2026" 36px/700/navy/tracking -0.025 + subtítulo 13px muted "28 movimientos · ARS y USD" + botón › 36px. Border-bottom 1px `#EEF1F4`, margin-bottom 32px.
> 2. **Recurrence banner**: card bg blanco border rounded-14 padding 16-20. Ícono Repeat slate en cuadrado 36 rounded-9 con bg `rgba(58,107,138,0.12)`. Texto: "¿Convertir 'Netflix' en recurrencia?" 14/600 + "Ya cargaste este movimiento 3 meses seguidos. Crear una regla mensual para que aparezca solo." 13 muted. Botones: "Descartar" ghost + "Crear regla" navy.
> 3. **Card "En qué se fue"** (híbrido) bg blanco border rounded-18 padding 28 32:
>    - Header: eyebrow "EN QUÉ SE FUE" + nav "‹ Mayo 2026 ›" (chevron 28 + h2 18/700 navy) + switcher ARS/USD pill (ARS activo navy, USD outline).
>    - Body flex gap-36:
>      - **Donut** 200x200 absoluto. SVG con 5 segmentos en orden: emerald 40%, teal 25%, slate 15%, terracotta 11%, plum 9%. Stroke-width 32. Centrado: eyebrow "GASTADO" + "$ 854K" 28/700 + "en 8 categorías" 11 soft.
>      - **Ranking** flex-col gap-16, 5 filas:
>        - Dot 10x10 emerald + 🛒 Supermercado 14/600 + "40% · 8 movimientos" 12 soft + $ 341K 15/700.
>        - Dot teal + 🛋️ Hogar + "25% · cuotas Sofá Sofías" + $ 213K.
>        - Dot slate + ☕ Comida y bebida + "15% · 14 movimientos" + $ 128K.
>        - Dot terracotta + 🎧 Suscripciones + "11% · 3 recurrentes" + $ 94K.
>        - Dot plum + "+ 4 categorías más" 14/600 muted + "9% · transporte, salud, otros" + $ 78K muted.
>    - Footer border-top: "Sin contar consumos en tarjeta sin pagar" 12 muted + link "Ver el detalle ›" emerald 12/600.
> 4. **Filter bar** (lo que falta): flex gap-12. Search input h-44 flex-1 rounded-12 border con ícono search soft + "Buscar por descripción, monto…" 14 soft. Botón Filtros h-44 padding 0-16 rounded-12 border con ícono SlidersHorizontal + "Filtros" + badge "2" navy circular.
> 5. **Day group "Hoy"** (lo que falta): header "Hoy" 13/600 navy + "Miércoles, 28 de mayo" 12 soft + (derecha) "3 movimientos" 12 soft tabular. Rows container bg-card border rounded-14 overflow-hidden. Cada fila: flex items-center gap-16 padding 16-20 border-bottom-1 `#EEF1F4` (excepto última).
>    - **Filas**:
>      - Ícono 40 rounded-11 bg slate-14% emoji ☕ + "Café con Pao" 15/600 + caption "Comida y bebida · Billetera" + (derecha) "−$ 3.200" 15/600 terracotta tabular.
>      - Ícono bg emerald-14% emoji 💼 + "Sueldo mayo" + chip "🔄 Recurrente" slate + caption "Trabajo · Banco Galicia" + "+$ 1.380.000" emerald.
>      - Ícono bg plum-14% emoji 🎧 + "Spotify Family" + chip "🔄 Recurrente" + caption "Suscripciones · Visa Galicia" + columna derecha: "−US$ 9,99" terracotta + caption "USD" 11 soft.
> 6. **Day group "Ayer"** (lo que falta): header "Ayer" + "Martes, 27 de mayo" + "4 movimientos".
>    - **Filas**:
>      - Ícono bg slate-14% emoji 🛋️ + "Sofá Sofías" + chip gris "3 cuotas" (bg `#EEF1F4` navy) + caption "Hogar · Visa Galicia" + "−$ 540.000" terracotta.
>      - Ícono bg-muted (`#EEF1F4`) con SVG ArrowLeftRight muted + "Pasar a la billetera" + caption "Banco Galicia → Billetera" + "$ 80.000" navy.
>      - Ícono bg-muted con SVG Coins muted + "Compra USD" + caption "@ 1.215" inline 12 muted + caption "Banco Galicia ARS → Banco Galicia USD" + columna derecha "US$ 200" navy + "USD" 11 soft.
>      - Ícono bg emerald-14% emoji 🛒 + "Reintegro Coto" + chip warning "A confirmar" (bg `rgba(196,154,60,0.18)` text `#8B6E1C`) + caption "Supermercado · Visa Galicia" + columna derecha "+$ 4.500" muted + "esperado" 11 soft.
> 7. **FAB** navy circular 60x60 fixed bottom-40 right-40 con Plus icon blanco. Shadow del design system.
>
> ### Requisitos del output
>
> - Un solo archivo HTML.
> - Inline styles (sin clases ni Tailwind).
> - Plus Jakarta Sans cargado vía `<link>` de Google Fonts.
> - Íconos como SVG inline (Lucide style, stroke 2).
> - Ancho viewport 1440 hardcodeado para preview fiel.
> - Al final, comentario `<!-- end -->` y nada más.
>
> Devolveme el HTML completo en un solo bloque de código.
