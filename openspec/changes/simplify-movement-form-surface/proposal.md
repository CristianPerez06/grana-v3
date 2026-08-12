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

## What Changes

- **Clasificación en un tap (el recorte más grande).** Hoy elegir una categoría con subcategorías cuesta 3 taps por el drill obligatorio. El alta SHALL ofrecer las **clasificaciones más frecuentes** del usuario como chips de selección directa (un tap, sin abrir el popover ni entrar al drill). Un chip es la **hoja** que el usuario más repite —una categoría, o una categoría + subcategoría—, con el **icono de la categoría** y el **label de la hoja** ("🍽️ Pedidos Ya"). Un tap resuelve categoría **+ subcategoría (si la hoja la incluye) + la cuenta más usada para esa clasificación**, de modo que "kiosco → todo listo" ocurre en un tap sin tipear. El picker completo queda como camino secundario ("Ver todas"), y ahí el **drill de subcategoría deja de ser obligatorio**: tocar la categoría la asigna a secas, con las subcategorías como refinamiento opcional. Elegir la categoría alcanza para guardar.
- **La descripción sigue opcional.** No se vuelve obligatoria. Es un acelerador, no un peaje: tipear un comercio conocido ("kiosco") prefiltra la clasificación vía la sugerencia por historial que ya existe (`suggestCategoryFromHistory`, hoy devuelve categoría/subcategoría; extenderla a la cuenta habitual queda como decisión — ver design). Quien no tipea, los chips lo resuelven igual.
- **La dimensión cuenta se deriva de los datos (tipo Y moneda).** Cuando el usuario tiene una sola cuenta elegible para el tipo **y la moneda** activos, el formulario no muestra el selector de cuenta: la cuenta queda implícita (con Billetera ARS + una cuenta USD, la moneda del hero desambigua sin abrir nada). Con dos o más elegibles, el selector aparece como chips inline (1 tap) o, con muchas cuentas, como fila + popover con secciones crédito/débito. La cuenta pasa a ser un **override**: la clasificación ya la resuelve.
- **La categoría maneja la cuenta, y va primero (orden invertido).** Elegir una clasificación autocompleta la cuenta/tarjeta más usada para ella (memoria `clasificación → cuenta`), mostrada y modificable. Como la categoría ahora determina la cuenta, el orden se invierte: Tipo → Monto → **Categoría** → Cuenta → Fecha → Descripción → Avanzado.
- **Jerarquía de tipos derivada de datos.** `gasto` e `ingreso` son primarios fijos. El **tercer lugar primario es dinámico**: el más usado y elegible entre `transferencia` y `cambio de moneda`; el otro y `ajuste` (siempre secundario) quedan tras "Otros", que aparece solo si hay un secundario elegible. Un usuario con una sola cuenta en una moneda ve solo `gasto`/`ingreso`. La partición se deriva de los datos (frecuencia + elegibilidad), no de un flag. En edición el tipo sigue inmutable.
- **Invariante anti-regresión: el gasto simple no cruza ninguna sección avanzada.** Reintegro, compartido, repetir y cuotas SHALL arrancar colapsadas y nunca ser obligatorias en el camino del gasto simple. Hoy es así en su mayoría; este change lo fija como requirement para que ningún rediseño futuro las vuelva a poner en el camino.
- **Peso visual por rol + monto recortado (mobile-web/native, gateado por breakpoint).** El monto se recorta para que los chips entren sin scroll; los campos secundarios (cuenta-override, fecha, descripción) pasan a una sola línea. El desktop no se toca.
- **Preselección de cuenta más probable.** Orden: cuenta de contexto → memoria de la clasificación → única elegible → última usada (si el caller la provee) → primera elegible. Nunca elige una cuenta no elegible.

**Fuera de alcance (Non-Goals):** las *funcionalidades nuevas* que Mobills tiene y Grana no (presupuestos por categoría, alertas de vencimiento, metas, flujo de caja, etiquetas, adjuntar comprobantes) NO entran acá — son módulos aparte del roadmap (`savings`, `cashflow`) o capabilities futuras. Este change solo reduce la fricción de la superficie que ya existe. Tampoco se toca ninguna regla contable.

## Capabilities

### Modified Capabilities

- `transactions`: suma requirements sobre la **superficie del formulario de alta** — jerarquía de tipos, ocultamiento de la dimensión cuenta derivado de datos, invariante de secciones avanzadas colapsadas y preselección de cuenta. No modifica ninguna regla de balance, signo, corte temporal ni el significado de `transactions.status`.

## Impact

- `packages/movement-form/src/use-movement-form.ts`: tercer tab primario dinámico (más usado y elegible entre `transfer`/`exchange`; `adjustment` siempre secundario) con `Gasto`/`Ingreso` anclados; `showAccountSelector` derivado de elegibilidad por tipo **y** moneda; `quickClassifications` (hojas `(category_id, subcategory_id)` frecuentes intersecadas con el catálogo activo); default de `accountId` en create según el orden de preselección (contexto → memoria de la clasificación → única elegible → última usada → primera).
- `packages/movement-form/src/types.ts`: el caller inyecta las hojas frecuentes (`frequentClassifications?`), el mapa `classificationAccountId?` (clasificación → cuenta-más-usada), la frecuencia de tipos secundarios para el tercer slot, y opcionalmente `lastUsedAccountId?` — el hook sigue I/O-free.
- `apps/web/lib/transactions/components/movement-form.tsx`: chips de clasificación de un tap **arriba** del `FieldRow` de categoría (orden invertido: categoría antes que cuenta); el picker completo deja de forzar el drill (tap = elige categoría, chevron = expande subs); el `Segmented` de tipo muestra primarios + affordance "Otros" derivada; el bloque de cuenta se condiciona a `showAccountSelector` y, cuando aparece, usa chips inline; monto recortado y filas secundarias a una línea, **gateado por breakpoint**.
- Lectura de datos derivados: queries baratas inyectadas por el caller (web RSC / mobile) — hojas frecuentes en ventana, mapa clasificación→cuenta, frecuencia de tipos secundarios.
- `apps/mobile`: el equivalente nativo hereda los mismos derivados desde el hook compartido (paridad vía contrato, sin lógica duplicada), incl. el orden invertido y las filas livianas.
- `packages/i18n-messages`: copy nuevo para la affordance de tipos secundarios ("Otros movimientos" / "Ajuste" / "Cambio de moneda" ya existen como labels).
- **Sin migración, sin cambios de schema, sin cambios de mutators contables.** El riesgo es puramente de UI/estado del formulario.
- **Dependencia/orden:** las reglas contables que el form dispara ya están estables en `main` (el change `fix-recurrence-projection-and-orphans` se mergeó en `521d005`). Este change se apoya sobre ese estado y solo agrega requirements nuevos a `transactions`, sin tocar los existentes.
