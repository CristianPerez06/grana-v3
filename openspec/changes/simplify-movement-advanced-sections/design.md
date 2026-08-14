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

- Que al activar una sección avanzada se revele **la superficie mínima**: lo secundario (cálculo por %/tope; cuenta de acreditación redundante) queda a un gesto de distancia, no volcado de entrada.
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

### 1. Reintegro: disclosure progresivo, no un card volcado

El card revelado muestra por defecto **monto estimado** + **"ya me lo acreditaron"** (los dos datos que definen el reintegro). El **cálculo por %/tope** —una conveniencia para derivar el monto, no un dato propio— pasa detrás de un disparador de un gesto ("calcular por %"): al accionarlo aparecen los campos `% del gasto` y `Tope`, que siguen escribiendo `reimbursementAmount` vía `applyReimbursementPercent`. La **cuenta de acreditación** se oculta cuando hay una sola cuenta cash/bank elegible (el hook ya la prerellena por institución), misma disciplina que el ocultamiento de la cuenta de origen del alta.

Alternativa considerada: dejar todo visible y solo unificar primitivos. Se descarta: el usuario señaló explícitamente este card como el que "hay que simplificar", y la superficie mínima es la lente de toda la épica.

Por qué el %/tope detrás de disclosure y no eliminado: sigue siendo la forma natural de cargar "me reintegran el 50% con tope $X" y el requirement nativo lo exige disponible (`applyReimbursementPercent`). Se conserva, se desprioriza.

### 2. Reintegro: primitivos equivalentes en web-mobile

Web-mobile adopta lo que nativo ya usa: **`Switch`** para "ya me lo acreditaron" (hoy `<input type=checkbox>`) y **filas de opción tipo `RadioRow`** para el destino *a cuenta / a resumen* en crédito (hoy `<input type=radio>` crudos). La cuenta de acreditación en web-mobile puede seguir siendo un `<select>` nativo del sistema (es el equivalente idiomático del picker de sheet nativo; ambos son "elegir de una lista"), pero cuando hay una sola cuenta no se renderiza en ninguna de las dos. La dirección de convergencia es **web-mobile → primitivos nativos** porque cumple la regla del repo y porque el usuario verifica el web-mobile en el navegador.

### 3. Compartido: presets + escape a "Otro %", un solo modelo en las dos superficies

Ambas superficies ofrecen tres chips de un gesto —**Vos** (`splitFirstPct = 100`), **Mitad** (`50`), **El otro** (`0`)— más un chip **"Otro %"** que revela el input de porcentaje libre (el editor `1..99` que hoy tiene web). El estado sigue siendo el único `splitFirstPct` del hook; los presets son escrituras directas, "Otro %" abre el editor fino.

Consecuencia clave: **el preset "El otro" ES el caso 0/100**, así que el `Switch` dedicado "es 100% del otro" **se elimina** de web-mobile — su función queda absorbida en un preset visible en vez de un toggle que había que descubrir. Esto **modifica** `shared/spec.md` (hoy manda un "toggle dedicado" para el 0/100): la semántica no cambia (`{pagador: 0, otro: 100}`), cambia cómo se alcanza.

Nativo **gana** el reparto arbitrario: hoy su `Segmented` de 3 presets viola su propio requirement ("cualquier reparto") y el `shared` §split (editor `1..99`). Con "Otro %" queda compliant.

Alternativa considerada: converger en solo-presets (100/50/0). Se descarta: es una regresión funcional (se pierde el 70/30 que hoy existe en web) y contradice `shared/spec.md`. Alternativa opuesta: % libre siempre visible en ambas. Se descarta por fricción — el caso común es un tap.

Presentación por plataforma: en web-mobile los presets son botones-chip; en nativo pueden seguir sobre `Segmented` **más** el chip "Otro %" al lado, o migrar a chips — la paridad se evalúa por rol (tres presets de un gesto + escape a % libre), no por el widget exacto. El editor libre usa el `MoneyAmountInput`/`Input` numérico equivalente de cada plataforma.

### 4. Repetir: unidad de intervalo como chips en ambas

El `<select>` de unidad (día/semana/mes/año) de web-mobile pasa a chips, espejo del nativo (`INTERVAL_UNITS`). Es la única divergencia de esta sección; el resto (frecuencia, count, fecha fin, hint) ya es paritario. Cambio chico, incluido para cerrar la sección al 100%.

### 5. i18n unificado del split

Hoy web usa `shared.split.*` y nativo `transactions.form.split_*` para el mismo control. Se elige **una** familia de claves para los tres presets, el "Otro %" y las etiquetas de reparto, consumida por ambas superficies. La familia canónica queda en el namespace que ya usa el resto del control compartido (a decidir en implementación; preferencia por `shared.split.*` por dominio). El copy nuevo: labels de los presets Vos/Mitad/El otro, el disparador "Otro %" y el disparador "calcular por %" del reintegro. Sin exponer jerga contable (regla `shared` de lenguaje llano).

## Risks / Trade-offs

- **Regresión de descubribilidad del %/tope y del 0/100.** Al esconder el %/tope tras un disclosure y el 0/100 dentro de "El otro", un usuario que los conocía debe re-descubrirlos. Mitigación: los presets son autoexplicativos ("El otro" nombra al miembro) y el "calcular por %" es un affordance visible; ninguno se elimina, solo se despriorizan.
- **Paridad evaluada por rol, no por píxeles.** Nativo puede conservar `Segmented` para los presets mientras web usa chips; alguien podría leerlo como "no idéntico". Es deliberado y consistente con el requirement de paridad vigente (rol/estructura, no pixel-parity).
- **Verificación asimétrica.** El nativo no se prueba en device en esta sesión (lo revisa el tech lead). Mitigación: los cambios nativos se apoyan en primitivos y estado ya existentes; el riesgo se concentra en el web-mobile, que sí se verifica en navegador.

## Migration / Rollout

No hay migración de datos ni de schema. Es un cambio de UI en dos archivos de app + i18n. Rollout directo: al mergear, el alta muestra las secciones simplificadas. Los movimientos existentes no se ven afectados (no cambia ningún dato persistido). El `openspec:check` y la CI (lint+typecheck web/mobile, tests) son el gate.
