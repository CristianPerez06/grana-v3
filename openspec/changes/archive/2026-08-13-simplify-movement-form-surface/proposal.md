## Why

Un usuario nos mostró Mobills en vivo y la sensación fue "hace casi lo mismo que Grana, pero se siente más simple". La comparativa que hicimos separó esa sensación en dos fuentes: **simplicidad de superficie** (menos decisiones por pantalla, la profundidad escondida hasta que hace falta) y **simplicidad conceptual** (un modelo contable más laxo). La segunda es el foso de Grana y no se toca. La primera es gratis y hoy no la estamos aprovechando del todo.

La superficie de mayor fricción es el alta de movimientos. Un solo hook (`@grana/movement-form`) maneja cinco tipos de movimiento como pestañas de igual peso (`gasto`, `ingreso`, `transferencia`, `ajuste`, `cambio`) más tres secciones avanzadas (reintegro, compartido, repetir) y la de cuotas. Para el 90% de los casos —cargar un gasto— el usuario ve un selector con cinco opciones donde solo usa una, y un selector de cuenta aunque tenga una sola cuenta.

Esto contradice un principio que el repo ya declara: **"perfil único, la profundidad sigue a los datos, no a un flag"** (`AGENTS.md`). La lista de cuentas ya oculta la dimensión cuenta cuando el usuario tiene una sola `Billetera`. El alta de movimientos todavía no hereda esa misma inteligencia. Este change la lleva al formulario, sin tocar ninguna regla contable.

Este change es la **primera parada de un pase de simplificación módulo por módulo** de Grana. El módulo Movimientos va primero porque es el de mayor frecuencia de uso. El lente es concreto y medible: **cantidad de taps** para completar la tarea más común.

### Presupuesto de taps — el objetivo medible

Auditoría del flujo actual "cargar un gasto simple" (cuenta cash/bank), la tarea del ~90%:

| Paso | Taps hoy | Nota |
|------|----------|------|
| Abrir el drawer (FAB) | 1 | — |
| Monto | 0 | ya tiene autofocus (`amountRef.focus()`) — se tipea directo |
| Tipo (gasto) | 0 | es el default |
| Cuenta (con 2+ cuentas) | 2 | abrir fila + elegir |
| Categoría (con subcategorías) | 3 | abrir + entrar al drill + elegir sub/"toda la categoría" |
| Fecha | 0 | default hoy |
| Guardar | 1 | — |
| **Total** | **~7** | (4 en el mejor caso: 1 cuenta + categoría sin subcategorías) |

**Meta:** bajar el gasto simple a **≤3 taps** (abrir · categoría de un tap · guardar), con el monto tipeado y la cuenta autoresuelta.

> **Alcance de este change (post-revisión del tech lead).** Este change es **solo superficie**: reshape de lo que ya existe, sin pipelines de datos nuevos. Entrega ~7 → **~4-5 taps** (drill de subcategoría fuera, cuenta oculta con una sola elegible, declutter, orden invertido, avanzado como chips). El salto final a **≤3** (chips de clasificación frecuente + cuenta autoresuelta) es **funcionalidad data-driven** y se ataca en el epic **#31**, después de mergear esto. El detalle y el rationale completo (incluido lo que va a #31) viven en `design.md`.

## What Changes

_(Solo superficie. Lo data-driven está marcado y vive en #31.)_

- **Subcategoría deja de ser un peaje (el recorte de superficie más grande).** Hoy elegir una categoría con subcategorías cuesta 3 taps por el drill obligatorio. El selector completo deja de forzarlo: **tocar la categoría la asigna a secas** (con las subcategorías como refinamiento opcional detrás de un chevron), y **elegir la categoría alcanza para guardar**. Baja categoría de 3 a 2 taps sin data nueva. _(Los **chips de clasificación frecuente** que la bajan a 1 tap son data-driven → **#31**.)_
- **La descripción sigue opcional.** No se vuelve obligatoria. La sugerencia por historial que ya existe (`suggestCategoryFromHistory`) sigue igual; extenderla a la cuenta habitual es **#31**.
- **La dimensión cuenta se deriva de los datos (por tipo).** Cuando el usuario tiene una sola cuenta elegible para el tipo activo, el formulario no muestra el selector de cuenta: la cuenta queda implícita. Con dos o más elegibles, el selector aparece como chips inline (1 tap) o, con muchas cuentas, como fila + popover con secciones crédito/débito. _(El refinamiento por **moneda** —ocultar también con una sola cuenta elegible para la moneda activa, p. ej. Billetera ARS + una cuenta USD, dejando que el toggle de moneda desambigüe— queda **diferido**: el toggle de moneda hoy es por cuenta, así que requiere un cambio en la cascada de moneda fuera de esta pasada.)_
- **Orden invertido: categoría antes que cuenta.** La categoría pasa a ser la decisión principal y va arriba: Tipo → Monto → **Categoría** → Cuenta → Fecha → Descripción → Avanzado. _(Que la categoría **autocomplete** la cuenta habitual —memoria `clasificación → cuenta`— es data-driven → **#31**; el orden en sí es superficie.)_
- **Tabs: Gasto · Ingreso · Otros.** Solo `gasto` e `ingreso` son primarios (fijos); `transferencia`, `ajuste` y `cambio de moneda` viven en **"Otros"** (hoja de un tap, gateados por elegibilidad). Partición estática — se descarta el "tercer slot dinámico", lo que **saca ese ítem de #31**. En edición el tipo sigue inmutable.
- **Invariante anti-regresión: el gasto simple no cruza ninguna sección avanzada.** Reintegro, compartido, repetir y cuotas SHALL arrancar sin activar y nunca ser obligatorias en el camino del gasto simple. La Capa 1 se presenta como una **fila slim de chips de activación** gateados por contexto (1–3 chips; tocar = activar + params inline), reemplazando los tres toggles apilados; **cuotas** queda pegada a la cuenta como forma de pago, fuera de esa fila.
- **Peso visual por rol + monto recortado (mobile-web/native, gateado por breakpoint).** El monto se recorta para que la categoría entre sin scroll; los campos secundarios (cuenta, fecha, descripción) pasan a una sola línea. El desktop no se toca.
- **Preselección de cuenta con datos existentes.** Orden: cuenta de contexto → única elegible → primera elegible. Nunca elige una cuenta no elegible. _(La **memoria de la clasificación** y la **última cuenta usada** son data-driven → **#31**.)_

**Fuera de alcance (Non-Goals):** las *funcionalidades nuevas* que Mobills tiene y Grana no (presupuestos por categoría, alertas de vencimiento, metas, flujo de caja, etiquetas, adjuntar comprobantes) NO entran acá — son módulos aparte del roadmap (`savings`, `cashflow`) o capabilities futuras. Este change solo reduce la fricción de la superficie que ya existe. Tampoco se toca ninguna regla contable.

## Capabilities

### Modified Capabilities

- `transactions`: suma requirements sobre la **superficie del formulario de alta** — jerarquía de tipos, ocultamiento de la dimensión cuenta derivado de datos, invariante de secciones avanzadas colapsadas y preselección de cuenta. No modifica ninguna regla de balance, signo, corte temporal ni el significado de `transactions.status`.

## Impact

- `packages/movement-form/src/use-movement-form.ts`: partición de tipos por elegibilidad (`Gasto`/`Ingreso` anclados + tercer slot secundario elegible; `adjustment` siempre secundario); `showAccountSelector` derivado de elegibilidad por tipo (el refinamiento por moneda queda diferido, anotado en el archivo); default de `accountId` en create por el orden con datos existentes (contexto → única elegible → primera).
- `apps/web/lib/transactions/components/movement-form.tsx`: orden invertido (categoría arriba de cuenta); el picker completo deja de forzar el drill (tap = elige categoría, chevron = expande subs); el `Segmented` de tipo muestra primarios + affordance "Otros" por elegibilidad; el bloque de cuenta se condiciona a `showAccountSelector` y, cuando aparece, usa chips inline; avanzado como fila de chips de activación (cuotas pegada a la cuenta); monto recortado y filas secundarias a una línea, **gateado por breakpoint**.
- `apps/mobile`: el equivalente nativo hereda los mismos derivados desde el hook compartido (paridad vía contrato, sin lógica duplicada), incl. el orden invertido, las filas livianas y los chips de avanzado.
- `packages/i18n-messages`: copy nuevo para la affordance de tipos secundarios ("Otros movimientos") y el placeholder de nota; los labels de tipo ya existen.
- **Sin migración, sin cambios de schema, sin cambios de mutators contables, sin queries nuevas.** El riesgo es puramente de UI/estado del formulario.
- **Follow-up (#31):** las funcionalidades data-driven (chips de clasificación frecuente, memoria categoría→cuenta / última usada, ranking del tercer tab por frecuencia, sugerencia→cuenta) — con sus queries nuevas — se atacan después de mergear este change. El rationale queda en `design.md`.
- **Dependencia/orden:** las reglas contables que el form dispara ya están estables en `main` (el change `fix-recurrence-projection-and-orphans` se mergeó en `521d005`). Este change se apoya sobre ese estado y solo agrega requirements nuevos a `transactions`, sin tocar los existentes.
