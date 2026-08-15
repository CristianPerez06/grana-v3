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

- Que al activar una sección avanzada se revele **la superficie mínima**, por densidad (reintegro: bloque compacto de 2 filas, sin labels) o por disclosure donde corresponda (editor de % libre del split tras "Otro %"), no volcando todos los controles de entrada.
- Que los parámetros revelados de las tres secciones se lean como **el mismo producto** en web-mobile y en nativo, por rol y estructura y por primitivos equivalentes.
- Que el split soporte **cualquier reparto** en ambas superficies (hoy nativo no puede 70/30), resolviendo el caso común de un tap.
- Unificar el copy i18n del split en una sola familia de claves.

**Non-Goals:**

- **No** se toca el hook `useMovementForm` ni sus tipos: el estado ya alcanza. Este change es de presentación.
- **No** se toca la superficie **desktop** de web (sigue gateada por breakpoint).
- **No** se toca el editor del **split por defecto del hogar** en `/shared/settings` (sigue `1..99`, el 0/100 es una decisión por-gasto).
- **No** hay migración ni cambios de schema: no hay columnas nuevas.
- **No** se cambian las reglas contables del reintegro, el split ni la recurrencia (montos, atomicidad, deuda derivada, generación de instancias) — solo cómo se ingresan.

## Decisions

### 1. Reintegro: bloque compacto de dos filas, superficie mínima por densidad

Diseño **cerrado con el PO** (canvas + handoff en `docs/design/movement-form/reintegro/`). El card deja de apilar 5 campos con labels (~330 px) y pasa a **dos filas compactas (~79 px), sin labels sobre los campos**:

- **Fila 1 — monto + regla.** El monto del reintegro (editable) y la regla **`% + tope` visible inline**, en dos cajas con borde propio. El % deriva el monto de forma **bidireccional** (`applyReimbursementPercent`); escribir un monto a mano descarta el %; el tope acota el monto calculado y su texto se resalta cuando aplicó.
- **Fila 2 — destino + estado.** Un control **`Resumen | Cuenta`** (solo con crédito; default **Resumen**) y el estado **"Acreditado"**.

Cambio de rumbo respecto de la hipótesis previa (%/tope detrás de un disparador "calcular por %"): **se descarta el disclosure**. En el layout compacto el %/tope no agrega altura significativa, así que esconderlo solo sumaba un tap sin ahorrar superficie real; además es la forma natural de cargar "me reintegran el 30% con tope $X". La superficie mínima se logra por **densidad** (2 filas, sin labels), no ocultando el control. El usuario había señalado este card como el que "hay que simplificar"; el diseño cerrado lo resuelve haciéndolo compacto, no progresivo.

### 2. Reintegro: destino Resumen/Cuenta y estado Acreditado; primitivos diseñados en web-mobile

El **destino** (solo con crédito) es un control **`Resumen | Cuenta`** con default **Resumen** (el resumen de la tarjeta con la que se paga). Preserva y hace explícita la funcionalidad activa: tocar **Cuenta** elige la cuenta de la **misma entidad del medio de pago** sin abrir nada (`pickReimbursementAccount`, ya existente), y tocar el **nombre** abre el selector con la cuenta de la misma entidad primero (rótulo "mismo banco"). Con cash/bank no hay resumen: el destino es *a cuenta*, y el selector se oculta cuando hay una sola cuenta cash/bank elegible.

El **estado** es un control **"Acreditado"** —en el diseño cerrado, un **checkbox compacto**, no un toggle-switch— coherente con el layout de 2 filas: off deja el reintegro pendiente de confirmación (sin chip ni texto "Pendiente"), on lo registra como recibido. Web-mobile reemplaza sus controles crudos (`<input type=checkbox>`, `<input type=radio>`, `<select>`) por los equivalentes diseñados, con la misma estructura que el nativo; la paridad se evalúa por rol, no por widget.

Nota sobre el primitivo del estado: la iteración previa proponía `Switch` (el que ya usa el nativo). El diseño cerrado optó por un **check** por densidad visual del bloque de 2 filas; la spec lo fija por rol ("control binario 'Acreditado', on=recibido / off=pendiente") y ambas superficies convergen en el check, no en el Switch.

### 3. Compartido: presets + escape a "Otro %", un solo modelo en las dos superficies

Ambas superficies ofrecen tres chips de un gesto —**Vos** (`splitFirstPct = 100`), **Mitad** (`50`), **El otro** (`0`)— más un chip **"Otro %"** que revela el input de porcentaje libre (el editor `1..99` que hoy tiene web). El estado sigue siendo el único `splitFirstPct` del hook; los presets son escrituras directas, "Otro %" abre el editor fino.

Consecuencia clave: **el preset "El otro" ES el caso 0/100**, así que el `Switch` dedicado "es 100% del otro" **se elimina** de web-mobile — su función queda absorbida en un preset visible en vez de un toggle que había que descubrir. Esto **modifica** `shared/spec.md` (hoy manda un "toggle dedicado" para el 0/100): la semántica no cambia (`{pagador: 0, otro: 100}`), cambia cómo se alcanza.

Nativo **gana** el reparto arbitrario: hoy su `Segmented` de 3 presets viola su propio requirement ("cualquier reparto") y el `shared` §split (editor `1..99`). Con "Otro %" queda compliant.

Alternativa considerada: converger en solo-presets (100/50/0). Se descarta: es una regresión funcional (se pierde el 70/30 que hoy existe en web) y contradice `shared/spec.md`. Alternativa opuesta: % libre siempre visible en ambas. Se descarta por fricción — el caso común es un tap.

Presentación por plataforma: en web-mobile los presets son botones-chip; en nativo pueden seguir sobre `Segmented` **más** el chip "Otro %" al lado, o migrar a chips — la paridad se evalúa por rol (tres presets de un gesto + escape a % libre), no por el widget exacto. El editor libre usa el `MoneyAmountInput`/`Input` numérico equivalente de cada plataforma.

### 4. Repetir: unidad de intervalo como chips en ambas

El `<select>` de unidad (día/semana/mes/año) de web-mobile pasa a chips, espejo del nativo (`INTERVAL_UNITS`). Es la única divergencia de esta sección; el resto (frecuencia, count, fecha fin, hint) ya es paritario. Cambio chico, incluido para cerrar la sección al 100%.

### 5. i18n unificado del split

Hoy web usa `shared.split.*` y nativo `transactions.form.split_*` para el mismo control. Se elige **una** familia de claves para los tres presets, el "Otro %" y las etiquetas de reparto, consumida por ambas superficies. La familia canónica queda en el namespace que ya usa el resto del control compartido (a decidir en implementación; preferencia por `shared.split.*` por dominio). El copy nuevo del split: labels de los presets Vos/Mitad/El otro y el disparador "Otro %". Para el reintegro, el copy nuevo son las etiquetas del destino **`Resumen` / `Cuenta`** y el rótulo **"mismo banco"** del selector (ya no hay disparador "calcular por %", porque el %/tope queda visible). Sin exponer jerga contable (regla `shared` de lenguaje llano).

## Risks / Trade-offs

- **Regresión de descubribilidad del 0/100.** Al mover el 0/100 dentro del preset "El otro", un usuario que usaba el toggle dedicado debe re-descubrirlo. Mitigación: el preset es autoexplicativo (nombra al miembro) y queda a la vista; no se elimina la capacidad, cambia cómo se alcanza. (El %/tope del reintegro **no** entra en este riesgo: el diseño cerrado lo deja visible inline.)
- **Check vs Switch en "Acreditado".** El diseño cerrado usa un checkbox donde el nativo hoy usa `Switch` y donde la iteración previa proponía `Switch`. Es una decisión deliberada por la densidad del bloque de 2 filas; la paridad se mantiene por rol (control binario on=recibido/off=pendiente) y ambas superficies convergen en el check. Riesgo bajo: es un cambio de widget, no de estado (`reimbursementReceivedNow` no cambia).
- **Paridad evaluada por rol, no por píxeles.** Nativo puede conservar `Segmented` para los presets mientras web usa chips; alguien podría leerlo como "no idéntico". Es deliberado y consistente con el requirement de paridad vigente (rol/estructura, no pixel-parity).
- **Verificación asimétrica.** El nativo no se prueba en device en esta sesión (lo revisa el tech lead). Mitigación: los cambios nativos se apoyan en primitivos y estado ya existentes; el riesgo se concentra en el web-mobile, que sí se verifica en navegador.

## Migration / Rollout

No hay migración de datos ni de schema. Es un cambio de UI en dos archivos de app + i18n. Rollout directo: al mergear, el alta muestra las secciones simplificadas. Los movimientos existentes no se ven afectados (no cambia ningún dato persistido). El `openspec:check` y la CI (lint+typecheck web/mobile, tests) son el gate.
