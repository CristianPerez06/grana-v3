# Relevamiento — Módulo Movimientos (Grana V3)

Estado: **entrega 1, 2 y 4** (inventario, oportunidades priorizadas, decisiones).
**Entrega 3 en curso:** primer handoff cerrado publicado en
[`detalle-compacto/`](./detalle-compacto/) (oportunidad P1).

Fecha del relevamiento: rama `claude/grana-movimientos-relevamiento-m8jn1v`, sobre
`8ec5218` (post `#32/#33/#34`, alta de movimientos ya rediseñada).

## 0. Método y superficies

Tres superficies, siempre nombradas explícitamente:

| Sigla | Superficie | Implementación |
|---|---|---|
| **N** | App nativa (Expo) | `apps/mobile/**` |
| **WM** | Web vista-mobile (`<768px`) | mismo código de `apps/web`, gateado por CSS o por `useIsMobile` |
| **WD** | Web desktop (`≥768px`) | `apps/web` |

Regla de lectura: cuando WM y WD comparten componente y solo cambian por
breakpoint CSS, la fila dice "WM=WD salvo…". `useIsMobile` (rama JS separada) hoy
**solo** existe en `movement-form.tsx`; en el resto del módulo WM es puro CSS.

---

## 1. Inventario por pantalla × superficie

### 1.1 Feed — lista de movimientos

**Archivos.** WD/WM: `app/(app)/transactions/{layout,page}.tsx`,
`_components/{transactions-header,transactions-content,movement-filters-container,movement-list-container,category-spending-overview-container,pending-*-container,recurrence-suggestion-banner-container}.tsx`,
`lib/transactions/components/{movement-list,movement-row,movement-filters,category-spending-overview,quick-add-fab,register-movement-button}.tsx`.
N: `app/(app)/transactions/index.tsx`, `components/movements/{MovementList,MovementRow}.tsx`,
`components/{recurrences/PendingRecurrencesBlock,transactions/PendingReimbursementsBlock,recurrences/RecurrenceSuggestionBanner}.tsx`.

**Qué muestra hoy, de arriba hacia abajo:**

| Bloque | WD | WM | N |
|---|---|---|---|
| Header | Título + link "Ver recurrencias" + CTA "Registrar movimiento" | Título + link "Ver recurrencias" (CTA oculto por `hidden sm:inline-flex`) | `PageHeader` navy: título + **icon-button Repeat** |
| Selector de mes | dentro del card de "En qué se fue" | idem | `MonthNavigator` propio, **arriba de todo** |
| Banner sugerencia de recurrencia | ✔ | ✔ | ✔ |
| Pendientes recurrentes | ✔ card colapsable, con edición inline | idem | ✔ **versión reducida** (sin edición, sin urgencia, sin aviso de saldo) |
| Reintegros a confirmar | ✔ card colapsable | idem | ✔ (confirmar expande monto+fecha) |
| "En qué se fue" (donut + ranking) | ✔ | ✔ apilado | ✖ **no existe** |
| Toolbar de acciones | 4 íconos (Search · Repeat · Users · Sliders) + chips activos | idem | ✖ **no existe** |
| Lista | filas agrupadas por día | idem | idem |
| Cargar más | botón secundario | idem | Pressable |
| Acceso a alta | CTA en header | FAB | FAB (`→ /transactions/new`, pantalla completa) |

**Anatomía de la fila (`MovementRow`).** Web y N comparten estructura: emoji/ícono
de categoría 36×36 → título (descripción, o categoría, o tipo) → hasta **5 badges
inline** (cuotas, recurrente, revisar, compartido, estado de reintegro) → subtítulo
(`categoría › subcategoría · cuenta`) → monto a la derecha (+ línea "USD" cuando
corresponde) → columna de saldo corriente solo en vista de cuenta y solo `≥md`.

**Costos medidos (taps):**

- Filtrar por categoría: **1 tap** por el ranking del donut (WD/WM) · **4 taps** por
  el sheet (Sliders → abrir select → elegir → Aplicar) · **imposible** en N.
- Buscar texto: 1 tap + tipeo en WD/WM · **imposible** en N.
- Ir a recurrencias: 1 tap, pero **hay dos puertas** en WD/WM (link del header +
  ícono Repeat de la toolbar).
- Cambiar de mes: 1 tap en las tres, pero el control vive en lugares distintos
  (dentro del card de gasto en web, arriba de todo en N).

**Recargado / redundante:**

- Toolbar de 4 íconos sin label, uno de los cuales (Repeat) duplica el link del header.
- El toggle "mostrar compartidos" (icono Users) es un **filtro persistente** disfrazado
  de ícono: no suma al badge de "Filtros (N)" y su estado activo se lee al revés
  (relleno = compartidos ocultos).
- Hasta 5 badges por fila compitiendo con el monto; en anchos de 360px el título se
  trunca a ~12 caracteres cuando hay 2+ badges.
- En WD la lista ocupa `max-w-[1080px]` con **dos columnas de contenido** (título,
  monto) y ~700px de aire a la derecha: el desktop paga el layout de mobile sin
  usar el espacio.

**Divergencias:** N no tiene **ni búsqueda, ni filtros, ni el donut**. Es la
divergencia más grande del módulo: la misma pantalla ofrece 3 dimensiones de
navegación en web y 1 (el mes) en nativo.

### 1.2 Detalle de movimiento

**Archivos.** WD/WM: `app/(app)/transactions/[txId]/page.tsx` +
`_components/global-transaction-detail.tsx` + `_components/detail/*` (16 archivos).
N: `app/(app)/transactions/[txId]/index.tsx` + `components/transactions/detail/{MovementDetailView,tiles,primitives}.tsx`.

**Composición WD/WM** (gasto simple en efectivo, con descripción):

1. *(condicional)* banner "Generado por una regla" — **arriba del botón Volver**
2. Topbar: `← Volver` + acciones (WD: Eliminar icon + Editar sólido / WM: `···` + barra inferior fija con "Editar")
3. Hero: ícono 72–88px · título · **monto 46–60px** · línea de flujo · fila de chips `[fecha][cuenta][categoría][subcategoría]`
4. *(condicional)* Alert de pedagogía contextual (off-ledger, reintegro pendiente…)
5. *(condicional)* Alert de cuota hija · *(condicional)* Alert de "Revisar"
6. Grilla "de un vistazo": `TilePaymentMethod` + `TileDetail` + `TileDescription` + `TileMonthWeight` — 2 columnas en WD, 1 en WM.

**Redundancia estructural — el hallazgo más fuerte del relevamiento.** Para el
movimiento más frecuente (gasto simple con descripción) el detalle repite **tres de
cuatro** datos:

| Dato | Aparece en | Y otra vez en |
|---|---|---|
| Descripción | título del hero | `TileDescription` (tile propio, full-width) |
| Fecha | chip del hero | fila "Fecha" de `TileDetail` |
| Cuenta | chip del hero | `TilePaymentMethod` (tile propio, 52px de badge) |
| Categoría / subcategoría | chips del hero | — (único no duplicado) |

En WM eso son ~3 pantallas de scroll para 4 datos. En WD la grilla de 2 columnas
deja el `TileDetail` con **una sola fila** ("Fecha") ocupando media pantalla.

**Composición N:** `PageHeader` navy (título = etiqueta genérica del tipo, back,
acciones lápiz/tacho) → hero → alert de cuota hija → alert de revisar → tiles en 1
columna.

**Divergencias N vs web (todas son *faltantes* en N):**

- ✖ Alert de **pedagogía contextual** — es un requirement **sin tag de plataforma**
  en `openspec/specs/transactions/spec.md` ("El detalle ofrece pedagogía in-context
  sobre off-ledger y reintegros pendientes"), o sea que N está **fuera de spec**.
- ✖ Tile "Peso en el mes"
- ✖ Tiles de recurrencia (`TileRecurrence`, `TileRecurrenceHistory`) y banner de regla
- ✖ Composición ARS/USD del pago de resumen
- ✖ Chip de moneda en el monto (N imprime "USD" en una línea aparte)

**Deriva contra la spec (web):**

- `DetailTopbar` renderiza `← Volver` **con label**; el requirement "El back del
  detalle se renderea como ícono solo, sin label de texto" pide ícono 36×36 sin texto.
- El banner "Generado por una regla" se pinta **antes** del topbar: queda un elemento
  clickeable por encima del control de "volver".

### 1.3 Recurrentes — lista

**WD/WM** (`recurring/page.tsx`): `PageHeader` (título + descripción + back + CTA) →
`PendingRecurrencesBlock` → `UpcomingRecurrences` (**dos cards**: "Próximos 7 días" y
"Resto del mes", grilla 2-col en WD) → `RecurringTabs` (Activas/Pausadas/Terminadas) →
lista.

**N** (`recurring/index.tsx`): `PageHeader` navy (título + back + `+`) → `Segmented`
(3 tabs con conteo) → lista de `RecurrenceRuleCard`.

**Divergencias:** N no tiene `UpcomingRecurrences` ni el badge de "duplicada"
(`duplicateRuleIds`). Web tiene descripción de página; N no. El CTA de creación es
un botón con label en web y un `+` en N.

**Recargado:** en WD, entre pendientes + próximos-7-días + resto-del-mes + tab activa,
la misma regla puede aparecer **hasta 3 veces** en la misma pantalla (como instancia
pendiente, como ocurrencia proyectada y como regla).

### 1.4 Recurrentes — detalle

**WD/WM** (`recurring/[id]/`): el chrome es un **link de texto pelado** `← Recurrencias`
(en `layout.tsx`), no un `PageHeader` ni el `DetailTopbar` del movimiento → fila de 3
icon-buttons (editar/pausar/borrar) alineados a la derecha → hero centrado (chips de
frecuencia + estado, monto, descripción) → card de filas clave/valor (frecuencia,
cuenta, categoría, próximo, fin, creado, origen) → historial de instancias.

**N** (`recurring/[id].tsx`): `PageHeader` navy con las 3 acciones → card resumen con
`Row` label/valor → `RecurrenceInstancesList`.

**Divergencia:** son **tres lenguajes de chrome distintos** en el mismo módulo
(DetailTopbar del movimiento / link pelado de la recurrencia / PageHeader navy de N).

### 1.5 Movimientos embebidos

| Contexto | Componente | Reusa la fila del módulo |
|---|---|---|
| Período de tarjeta (web) | `app/(app)/cards/_components/period-movements-pane.tsx` | ✔ `MovementList` + `MovementRow` |
| Período de tarjeta (N) | `components/cards/detail/PeriodMovementsPane.tsx` | ✔ `MovementList` + `MovementRow` nativos |
| Detalle de cuenta (web) | `app/(app)/accounts/[id]/_components/movement-list-account-container.tsx` | ✔ mismo `MovementRow` (+ saldo corriente `≥md`) |
| Detalle de cuenta (N) | `components/accounts/MovementsSection.tsx` | ✖ **usa otra fila**: `components/accounts/MovementRow.tsx` (72 líneas, legacy) |

**Divergencia dura:** N tiene **dos filas de movimiento**. La legacy no muestra emoji
de categoría, ni badges, ni compartido, ni estado de reintegro, y arma su propia
tabla de meses. Web resolvió esto con una sola fila para los cuatro contextos.

**Asimetría inversa:** el detalle de cuenta en N **sí** tiene toolbar completa
(mes + búsqueda + sheet de filtros + chips), mientras que el feed global en N **no
tiene ninguna**. La capacidad ya existe en el código nativo; está montada en el lugar
menos usado.

### 1.6 Alta / edición (referencia, no se rehace)

Ya rediseñada (`#32/#33/#34`): tabs Gasto·Ingreso·Otros, monto héroe, chips de
categoría, selector de cuenta por familia Débito/Crédito, chips Hoy/Ayer, avanzadas
como chips symbol-forward que revelan sus parámetros inline. Es el **estándar de
densidad** a replicar en el resto del módulo. Documentado en
`docs/design/movement-form/{README,IMPLEMENTATION-NOTES}.md`.

Dos pendientes menores ya anotados ahí: monto centrado en N, y el drilldown del
selector de cuenta con muchas cuentas.

---

## 2. Divergencias transversales

| # | Divergencia | WD | WM | N |
|---|---|---|---|---|
| D1 | Búsqueda + filtros en el feed | ✔ | ✔ | ✖ |
| D2 | "En qué se fue" en el feed | ✔ | ✔ | ✖ |
| D3 | Ubicación del selector de mes | dentro del donut | dentro del donut | card propio arriba |
| D4 | Pedagogía contextual en el detalle | ✔ | ✔ | ✖ (fuera de spec) |
| D5 | "Peso en el mes" / tiles de recurrencia en el detalle | ✔ | ✔ | ✖ |
| D6 | Badge "Recurrente" en la fila | ✔ | ✔ | ✖ |
| D7 | Fila de movimiento única | ✔ (1 fila, 4 contextos) | ✔ | ✖ (2 filas) |
| D8 | Edición inline de la instancia recurrente pendiente | ✔ | ✔ | ✖ |
| D9 | Aviso de saldo negativo al confirmar una recurrente | ✔ | ✔ | ✖ |
| D10 | Chrome del detalle de recurrencia | link pelado | link pelado | PageHeader navy |
| D11 | `UpcomingRecurrences` | ✔ | ✔ | ✖ |
| D12 | i18n del selector de mes | ✔ | ✔ | ✖ `MonthNavigator` hardcodea meses en español |

---

## 3. Oportunidades priorizadas

Orden = frecuencia de uso × taps/scroll ahorrados × divergencia, contra esfuerzo.
"Comportamiento" marca lo que **no** es solo presentación.

### P1 · Detalle: fusionar hero y tiles (sacar la duplicación)
- **Superficies:** N + WM + **WD sí se beneficia** (el `TileDetail` de una fila en
  grilla 2-col es puro aire).
- **Qué:** el hero conserva monto + título + tono. La fila de chips se queda con lo
  que *no* tiene tile (categoría/subcategoría). `TileDescription` desaparece cuando la
  descripción **es** el título del hero. `TilePaymentMethod` y la fila "Fecha" se
  funden en un único bloque compacto de 2 filas — el mismo patrón de los bloques del
  alta: `[cuenta · tipo] / [fecha · estado]`.
- **Ahorro:** ~40% del alto del detalle en WM/N para el caso más frecuente; en WD la
  grilla pasa de 4 tiles desparejos a 2 densos.
- **Riesgo:** bajo. **Solo visual.**
- **Esfuerzo:** medio (toca el orquestador web + el nativo, pero los tiles ya existen).

### P2 · Feed nativo: darle búsqueda y filtros (cerrar D1)
- **Superficies:** N. (WD/WM ya lo tienen.)
- **Qué:** montar en el feed global la misma toolbar que **ya existe** en
  `components/accounts/MovementsSection.tsx` + `MovementFiltersSheet.tsx`. No hay que
  inventar: hay que mover y parametrizar.
- **Ahorro:** de "imposible" a 1–3 taps para la tarea más común después de mirar.
- **Riesgo:** bajo-medio (hay que decidir si filtra en cliente o pide al servidor).
- **Comportamiento:** sí — agrega capacidad donde no había.
- **Esfuerzo:** medio.

### P3 · Fila de movimiento: presupuesto de badges
- **Superficies:** las tres. **WD se beneficia** (puede permitirse más que N).
- **Qué:** máximo **2 badges** visibles; el resto se colapsa. Prioridad por
  información accionable: estado de reintegro > revisar > compartido > cuotas >
  recurrente. En N, el badge "Recurrente" se agrega recién dentro de ese presupuesto
  (cierra D6 sin engordar la fila).
- **Ahorro:** el título deja de truncarse en 360px; la fila baja de 3 líneas a 2.
- **Riesgo:** bajo. **Solo visual** (ningún dato se pierde: todos están en el detalle).
- **Esfuerzo:** bajo.

### P4 · Unificar la fila nativa (cerrar D7)
- **Superficies:** N.
- **Qué:** el detalle de cuenta en N pasa a usar `components/movements/MovementRow`;
  se borra `components/accounts/MovementRow.tsx`.
- **Ahorro:** −72 líneas, y el detalle de cuenta gana emoji, badges y estado de
  reintegro gratis. Deuda estructural que la política Web↔Mobile ya prohíbe.
- **Riesgo:** bajo. **Solo visual**, pero cambia lo que se ve en esa lista.
- **Esfuerzo:** bajo-medio (hay que mapear `TransactionWithDetails` → `FinancialMovement`).

### P5 · Una sola puerta a Recurrencias + header pelado (cerrar deriva de spec)
- **Superficies:** WD + WM.
- **Qué:** sacar el link "Ver recurrencias" del header y dejar el ícono Repeat de la
  toolbar (que es lo que la spec pide). El header queda pelado + CTA en WD.
- **Ahorro:** una fila menos arriba de todo; una decisión menos.
- **Riesgo:** bajo. **Solo visual.**
- **Esfuerzo:** bajo.

### P6 · Toolbar del feed: el toggle "compartidos" sale de la fila de íconos
- **Superficies:** WD + WM (y N cuando llegue P2).
- **Qué:** "mostrar compartidos" es un filtro, no una acción: se muda al sheet de
  filtros como switch y **suma al conteo** del badge. La toolbar baja de 4 a 3 íconos,
  que es exactamente lo que la spec describe.
- **Riesgo:** bajo, pero cambia dónde vive un control persistido en `localStorage`.
- **Comportamiento:** leve (el filtro pasa a contar en "Filtros (N)").
- **Esfuerzo:** bajo.

### P7 · Chrome único de detalle en todo el módulo (cerrar D10)
- **Superficies:** las tres.
- **Qué:** el detalle de recurrencia adopta el mismo topbar que el detalle de
  movimiento (back + acciones a la derecha), y en N los tres detalles usan el mismo
  `PageHeader`. De paso, el back del movimiento pasa a **ícono solo** (spec).
- **Riesgo:** bajo. **Solo visual.**
- **Esfuerzo:** bajo-medio.

### P8 · Recurrentes: fusionar "Próximos 7 días" + "Resto del mes"
- **Superficies:** WD + WM. **WD se beneficia** (deja de gastar una grilla de 2
  columnas en información puramente informativa).
- **Qué:** una sola card "Próximas", con separador de sección adentro. Y en la lista de
  reglas, no repetir la regla que ya está arriba como instancia pendiente.
- **Riesgo:** bajo. **Solo visual.**
- **Esfuerzo:** bajo.

### P9 · Selector de mes en el mismo lugar en las tres superficies (cerrar D3)
- **Superficies:** las tres.
- **Qué:** decidir un único dueño del mes. Ligado a la decisión **DC-2** (abajo), porque
  en web el mes vive dentro del card del donut y en N no hay donut.
- **Riesgo:** medio si se mueve en web (la spec dice explícitamente que el único
  selector vive dentro del card del breakdown).
- **Comportamiento:** no, pero **toca spec**.
- **Esfuerzo:** medio.

### P10 · Paridad de detalle en N: pedagogía contextual (cerrar D4)
- **Superficies:** N.
- **Qué:** portar el `Alert` de contexto. Es el único ítem del inventario que hoy es
  un **incumplimiento de spec**, no una decisión de diseño.
- **Riesgo:** bajo. **Solo visual** (el resolver ya existe y es puro).
- **Esfuerzo:** bajo.

### P11 · Paridad de la instancia recurrente pendiente en N (cerrar D8/D9)
- **Superficies:** N.
- **Qué:** edición inline de monto/fecha antes de confirmar + aviso de saldo negativo.
- **Riesgo:** medio — el aviso de saldo negativo es una garantía contable
  ("avisa sin bloquear") que hoy N no da.
- **Comportamiento:** sí.
- **Esfuerzo:** medio.

### P12 · WD: aprovechar el ancho (fila de 3 columnas)
- **Superficies:** **solo WD**.
- **Qué:** en `≥lg`, la fila del feed gana una columna de fecha/cuenta a la izquierda
  del monto en vez de amontonar todo en el subtítulo. **No** convertirlo en tabla con
  acciones masivas: el módulo no las tiene y agregarlas es otro proyecto.
- **Riesgo:** bajo, pero es el único ítem donde WD **diverge a propósito** de WM/N.
- **Esfuerzo:** medio.

### P13 · `MonthNavigator` nativo i18n (cerrar D12)
- **Superficies:** N. Esfuerzo trivial, impacto chico pero es un bug de idioma real.

**Lo que quedó explícitamente afuera:** totales agregados en la lista (la spec los
prohíbe), acciones masivas en WD (no existen hoy; agregarlas es alcance nuevo), y
cualquier toque a reglas contables, atomicidad, deuda derivada o generación de
instancias.

---

## 4. Decisiones a confirmar (cambios de comportamiento)

| # | Decisión | Por qué se pregunta |
|---|---|---|
| **DC-1** | ✅ **CERRADA** — la descripción deja de tener tile propio cuando ya es el título del hero (excepción: descripción larga ⇒ fila "Nota"). | Era la mitad del ahorro de P1. |
| **DC-2** | ✅ **CERRADA, y asciende a principio del módulo** — **N ≡ WM**: la app nativa y la web en vista mobile deben ser idénticas. Aplica a todo el módulo, no solo al donut. | Consecuencia: el donut, la búsqueda y los filtros **van** al feed nativo (no se sacan de web-mobile); y toda divergencia N↔WM del inventario pasa de "oportunidad" a "deuda a cerrar". |
| **DC-3** | ¿"Mostrar compartidos" pasa a ser un filtro contable dentro del sheet (y suma al badge)? | Cambia el conteo de "Filtros (N)" y el lugar donde el usuario lo busca. |
| **DC-4** | ¿El back del detalle pasa a ícono solo, sin "Volver"? | Es lo que pide la spec, pero es una regresión de claridad en WD. Hay que elegir: corregir el código o corregir la spec. |
| **DC-5** | ¿El presupuesto de 2 badges por fila, o se prefiere permitir 3 en WD? | P3 es la única oportunidad donde WD podría legítimamente divergir de N. |
| **DC-6** | ¿N gana el aviso de saldo negativo al confirmar una recurrente? | Es una garantía de producto ("avisa sin bloquear") que hoy la app nativa no cumple. No es cosmético. |
| **DC-7** | ¿El filtrado del feed nativo se resuelve en cliente (como el detalle de cuenta) o pidiendo al servidor (como el feed web)? | Define el esfuerzo de P2 y el comportamiento con historial largo. |

---

## 5. Handoffs — plan y estado

| # | Handoff | Cubre | Estado |
|---|---|---|---|
| 1 | [`detalle-compacto/`](./detalle-compacto/) | P1 (+ P10 y la paridad de detalle que arrastra N ≡ WM) | ✅ **publicado** |
| 2 | `fila-movimiento/` | P3 + P4 + P6 — matriz de badges, los 4 contextos donde vive la fila, los 3 anchos | pendiente — necesita **DC-5** |
| 3 | `feed-toolbar/` | P2 + P5 + P9 — toolbar y filtros en las 3 superficies, incluida la versión nativa que hoy no existe | pendiente — necesita **DC-3** y **DC-7** |

Cada uno con mockup HTML (canvas con todos los estados) + README de anatomía,
comportamiento, specs (medidas + tokens), estados y "Qué NO hacer", igual que los
handoffs de `docs/design/movement-form/`.

**El principio N ≡ WM reordena la prioridad.** Con las dos superficies obligadas a ser
idénticas, las divergencias D1, D2, D4, D5, D6 y D8 dejan de ser "oportunidades" y pasan
a ser deuda: el handoff 3 (toolbar + filtros + donut en nativo) sube a la par del 2.
