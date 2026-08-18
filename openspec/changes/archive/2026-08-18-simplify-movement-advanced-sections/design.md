# Design: simplify-movement-advanced-sections

## Context

Las tres secciones avanzadas del alta viven detrás de chips de activación (patrón "D9"): una fila de `AdvChip` y, debajo, las tarjetas de parámetros en orden fijo (reintegro → compartido → repetir), cada una condicionada a su chip. Ese mecanismo de despliegue **ya es paritario** entre `apps/web/lib/transactions/components/movement-form.tsx` (rama `isMobile`) y `apps/mobile/components/transactions/MovementForm.tsx`. Lo que diverge está **dentro** de los parámetros:

- **Reintegro** (`movement-form.tsx` `togglesGroup`, ~L1833–2009 / `MovementForm.tsx` ~L872–982): web usa `<input type=checkbox>`, `<input type=radio>` y `<select>`; nativo usa `Switch`, `RadioRow` y `AccountSelectField`. Ambos vuelcan monto + %/tope + cuenta + recibido de una.
- **Compartido** (`movement-form.tsx` ~L2011–2096 / `MovementForm.tsx` ~L985–1010): web = input `1..99` + `Switch` fully-other; nativo = `Segmented` de 3 presets (100/50/0). El hook guarda `splitFirstPct: number`.
- **Repetir** (`movement-form.tsx` ~L2098–2202 / `MovementForm.tsx` ~L1013–1099): idénticos salvo la unidad del intervalo custom (web `<select>` / nativo chips).

El modelo de datos ya es común: el hook expone `splitFirstPct`, `reimbursementReceivedNow`, `reimbursementPercent`, `reimbursementCap`, `intervalUnit` con el mismo shape para las dos superficies. Ninguna divergencia es de comportamiento del hook; todas son de la capa de pintado por plataforma.

Restricciones del repo que enmarcan el diseño:

- **JSX no se comparte** entre web y RN. La paridad se garantiza por rol/estructura y por primitivos equivalentes (`@grana/ui-contracts`), no por un componente común.
- **"Equivalent screens MUST use the equivalent primitive"** (AGENTS.md, component layering): un `<input type=checkbox>` crudo donde existe `Switch` es una violación de esa regla.
- El **split por defecto del hogar** (`/shared/settings`) es una superficie distinta, acotada a `1..99` por `shared/spec.md`; este change no la toca.

## Goals / Non-Goals

**Goals:**

- Que al activar una sección avanzada se revele **la superficie mínima**, por densidad (reintegro/recurrente: bloques compactos de 2 filas, sin labels) o por disclosure donde corresponda (editor de % libre del split tras "Otro"), no volcando todos los controles de entrada.
- Que los parámetros revelados de las tres secciones se lean como **el mismo producto** en web-mobile y en nativo, por rol y estructura y por primitivos equivalentes.
- Que el split soporte **cualquier reparto** en ambas superficies (hoy nativo no puede 70/30), resolviendo el caso común de un tap.
- Unificar el copy i18n del split en una sola familia de claves.

**Non-Goals:**

- **No** se toca el hook `useMovementForm` ni sus tipos: el estado ya alcanza. Este change es de presentación. (Excepción acotada: un fix de robustez en el helper `pickReimbursementAccount` para que la sugerencia de cuenta de la misma entidad matchee por `institutionId` **o**, si difiere, por nombre de institución — una tarjeta y una cuenta del mismo banco pueden vivir en filas de institución distintas. No cambia estado, tipos ni contrato del hook; solo hace más confiable una funcionalidad ya existente.)
- **No** se toca la superficie **desktop** de web (sigue gateada por breakpoint).
- **No** se toca el editor del **split por defecto del hogar** en `/shared/settings` (sigue `1..99`, el 0/100 es una decisión por-gasto).
- **No** hay migración ni cambios de schema: no hay columnas nuevas.
- **No** se cambian las reglas contables del reintegro, el split ni la recurrencia (montos, atomicidad, deuda derivada, generación de instancias) — solo cómo se ingresan.

## Decisions

### 1. Reintegro: bloque compacto de dos filas, superficie mínima por densidad

Diseño **cerrado con el PO** (canvas + handoff en `docs/design/movement-form/reintegro/`). El card deja de apilar 5 campos con labels (~330 px) y pasa a **dos filas compactas (~79 px), sin labels sobre los campos**:

- **Fila 1 — monto + regla.** El monto del reintegro (editable) y la regla **`% + tope` visible inline**, en dos cajas con borde propio. El % deriva el monto de forma **bidireccional** (`applyReimbursementPercent`); escribir un monto a mano descarta el %; el tope acota el monto calculado y su texto se resalta cuando aplicó.
- **Fila 2 — destino + estado.** Un control **`Resumen | Cuenta`** (solo con crédito; el default lo fija el hook, sin cambio de comportamiento) y el estado **"Acreditado"**.

Cambio de rumbo respecto de la hipótesis previa (%/tope detrás de un disparador "calcular por %"): **se descarta el disclosure**. En el layout compacto el %/tope no agrega altura significativa, así que esconderlo solo sumaba un tap sin ahorrar superficie real; además es la forma natural de cargar "me reintegran el 30% con tope $X". La superficie mínima se logra por **densidad** (2 filas, sin labels), no ocultando el control. El usuario había señalado este card como el que "hay que simplificar"; el diseño cerrado lo resuelve haciéndolo compacto, no progresivo.

### 2. Reintegro: destino Resumen/Cuenta y estado Acreditado; primitivos diseñados en web-mobile

El **destino** (solo con crédito) es un control **`Resumen | Cuenta`**. El valor por defecto lo sigue fijando el hook (hoy `'account'`), sin cambio de comportamiento: el PO optó por no tocar la semántica contable, así que el bloque abre en el destino que el hook ya elige y el rediseño solo cambia la presentación del control. Preserva y hace explícita la funcionalidad activa: tocar **Cuenta** elige la cuenta de la **misma entidad del medio de pago** sin abrir nada (`pickReimbursementAccount`, ya existente), y tocar el **nombre** abre el selector con la cuenta de la misma entidad primero (rótulo "mismo banco"). Con cash/bank no hay resumen: el destino es *a cuenta*, y el selector se oculta cuando hay una sola cuenta cash/bank elegible.

El **estado** es un control **"Acreditado"** —en el diseño cerrado, un **checkbox compacto**, no un toggle-switch— coherente con el layout de 2 filas: off deja el reintegro pendiente de confirmación (sin chip ni texto "Pendiente"), on lo registra como recibido. Web-mobile reemplaza sus controles crudos (`<input type=checkbox>`, `<input type=radio>`, `<select>`) por los equivalentes diseñados, con la misma estructura que el nativo; la paridad se evalúa por rol, no por widget.

Nota sobre el primitivo del estado: la iteración previa proponía `Switch` (el que ya usa el nativo). El diseño cerrado optó por un **check** por densidad visual del bloque de 2 filas; la spec lo fija por rol ("control binario 'Acreditado', on=recibido / off=pendiente") y ambas superficies convergen en el check, no en el Switch.

### 3. Compartido: atajos + barra de reparto (diseño cerrado con el PO)

Diseño cerrado en `docs/design/movement-form/compartir/`. Ambas superficies ofrecen **atajos de un gesto** —**Mitad** (`splitFirstPct = 50`), **70/30** (`70`), **75/25** (`75`) (los % son *tu parte*) y **Todo suyo** (`0`)— más un chip **"Otro"** que transforma la fila de chips en **dos campos %** (el tuyo editable con teclado del sistema; el del otro se calcula solo, gris, no editable). Debajo, una **barra de reparto** proporcional muestra **Vos** (izq, `#3A6B8A`) y el **otro integrante** (der, `#0E9E6E`), con el nombre traído del Hogar; el nombre se cae primero si el segmento no alcanza, el `%` queda. El estado sigue siendo el único `splitFirstPct` del hook.

Decisiones respecto del canvas original (con el PO):
- Se **quita "80/20"** para que los 5 chips entren en una fila (con "Todo suyo", más ancho).
- "100%" se **renombra a "Todo suyo"** (los otros chips son *tu parte*; este es el inverso: `{pagador: 0, otro: 100}`). Reemplaza al `Switch` "es 100% del otro", que **se elimina**. Esto **modifica** `shared/spec.md`: la semántica no cambia, cambia cómo se alcanza.
- **No** hay chip "todo mío" (100% propio no se marca compartido).

Nativo **gana** el reparto arbitrario: hoy su `Segmented` de 3 presets viola su propio requirement ("cualquier reparto"). Con los atajos + "Otro" queda compliant.

Presentación por plataforma: web-mobile usa botones-chip + una barra con `flex` proporcional; nativo replica los chips (Pressables) y la barra con `View`s proporcionales. La paridad se evalúa por rol (atajos de un gesto + barra + escape a % libre), no por el widget exacto. El editor libre usa el input numérico equivalente de cada plataforma (teclado del sistema, no uno propio).

### 4. Repetir: unidad de intervalo como chips en ambas

El `<select>` de unidad (día/semana/mes/año) de web-mobile pasa a chips, espejo del nativo (`INTERVAL_UNITS`). Es la única divergencia de esta sección; el resto (frecuencia, count, fecha fin, hint) ya es paritario. Cambio chico, incluido para cerrar la sección al 100%.

### 5. i18n unificado del split

Hoy web usa `shared.split.*` y nativo `transactions.form.split_*` para el mismo control. Se elige **una** familia de claves (`shared.split.*`) para los atajos, el "Otro" y las etiquetas de la barra, consumida por ambas superficies. El copy nuevo del split: `half` ("Mitad"), `all_other` ("Todo suyo"), `you` ("Vos"), `other_short` ("Otro"), `owes` ("te debe") y `write_your_share` ("Escribí tu parte") — los ratios `70/30`/`75/25` son literales numéricos. Los labels viejos `transactions.form.split_*`/`your_share` quedan sin uso en mobile. Para el reintegro, el copy nuevo son las etiquetas del destino **`Resumen` / `Cuenta`** y el rótulo **"mismo banco"** del selector (ya no hay disparador "calcular por %", porque el %/tope queda visible). Sin exponer jerga contable (regla `shared` de lenguaje llano).

## Risks / Trade-offs

- **Regresión de descubribilidad del 0/100.** Al mover el 0/100 al atajo "Todo suyo", un usuario que usaba el toggle dedicado debe re-descubrirlo. Mitigación: el atajo es autoexplicativo ("Todo suyo") y queda a la vista, con la barra reforzando el reparto; no se elimina la capacidad, cambia cómo se alcanza. (El %/tope del reintegro **no** entra en este riesgo: el diseño cerrado lo deja visible inline.)
- **Check vs Switch en "Acreditado".** El diseño cerrado usa un checkbox donde el nativo hoy usa `Switch` y donde la iteración previa proponía `Switch`. Es una decisión deliberada por la densidad del bloque de 2 filas; la paridad se mantiene por rol (control binario on=recibido/off=pendiente) y ambas superficies convergen en el check. Riesgo bajo: es un cambio de widget, no de estado (`reimbursementReceivedNow` no cambia).
- **Paridad evaluada por rol, no por píxeles.** Nativo puede conservar `Segmented` para los presets mientras web usa chips; alguien podría leerlo como "no idéntico". Es deliberado y consistente con el requirement de paridad vigente (rol/estructura, no pixel-parity).
- **Verificación asimétrica.** El nativo no se prueba en device en esta sesión (lo revisa el tech lead). Mitigación: los cambios nativos se apoyan en primitivos y estado ya existentes; el riesgo se concentra en el web-mobile, que sí se verifica en navegador.

## Migration / Rollout

No hay migración de datos ni de schema. Es un cambio de UI en dos archivos de app + i18n. Rollout directo: al mergear, el alta muestra las secciones simplificadas. Los movimientos existentes no se ven afectados (no cambia ningún dato persistido). El `openspec:check` y la CI (lint+typecheck web/mobile, tests) son el gate.
