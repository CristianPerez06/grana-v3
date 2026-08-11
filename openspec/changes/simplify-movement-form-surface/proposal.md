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

- **Categoría en un tap (el recorte más grande).** Hoy elegir una categoría con subcategorías cuesta 3 taps por el drill obligatorio. El alta SHALL ofrecer las categorías recientes/frecuentes del usuario como chips de selección directa (un tap, sin abrir el popover ni entrar al drill), al estilo de la grilla de Mobills. El picker completo con drill queda como camino secundario ("Ver todas"). La subcategoría deja de ser un paso obligatorio: elegir la categoría alcanza para guardar.
- **La dimensión cuenta se deriva de los datos.** Cuando el usuario tiene una sola cuenta elegible para el tipo activo, el formulario no muestra el selector de cuenta: la cuenta queda implícita (igual que la lista de cuentas ya oculta la columna de cuenta con una sola `Billetera`). Con dos o más, el selector aparece — y la preselección apunta a la más probable para que quede en 1 tap o 0.
- **Jerarquía de tipos de movimiento.** `gasto`, `ingreso` y `transferencia` son los verbos diarios y siguen como opciones primarias. `ajuste` y `cambio de moneda` son ocasionales: pasan a una superficie secundaria ("Otros"), alcanzable en un tap, en vez de ocupar dos de cinco ranuras de igual peso. En edición el tipo sigue siendo inmutable.
- **Invariante anti-regresión: el gasto simple no cruza ninguna sección avanzada.** Reintegro, compartido, repetir y cuotas SHALL arrancar colapsadas y nunca ser obligatorias en el camino del gasto simple. Hoy es así en su mayoría; este change lo fija como requirement para que ningún rediseño futuro las vuelva a poner en el camino.
- **Preselección de cuenta más probable.** El alta preselecciona la cuenta con la que el usuario probablemente va a operar: la cuenta de contexto si viene de una vista de cuenta (ya existe), la única elegible si hay una sola, o —decisión de PO— la última usada en vez de la primera de la lista.

**Fuera de alcance (Non-Goals):** las *funcionalidades nuevas* que Mobills tiene y Grana no (presupuestos por categoría, alertas de vencimiento, metas, flujo de caja, etiquetas, adjuntar comprobantes) NO entran acá — son módulos aparte del roadmap (`savings`, `cashflow`) o capabilities futuras. Este change solo reduce la fricción de la superficie que ya existe. Tampoco se toca ninguna regla contable.

## Capabilities

### Modified Capabilities

- `transactions`: suma requirements sobre la **superficie del formulario de alta** — jerarquía de tipos, ocultamiento de la dimensión cuenta derivado de datos, invariante de secciones avanzadas colapsadas y preselección de cuenta. No modifica ninguna regla de balance, signo, corte temporal ni el significado de `transactions.status`.

## Impact

- `packages/movement-form/src/use-movement-form.ts`: orden/partición de `Tab` en primarios vs secundarios; default de `accountId` en create (única elegible / última usada); derivados `showAccountSelector` y `quickCategories` (recientes/frecuentes).
- `packages/movement-form/src/types.ts`: el caller inyecta las categorías recientes/frecuentes (`recentCategoryIds?`) y opcionalmente `lastUsedAccountId?` — el hook sigue I/O-free.
- `apps/web/lib/transactions/components/movement-form.tsx`: chips de categoría de un tap arriba del `FieldRow` de categoría (que pasa a "Ver todas"); el `Segmented` de tipo se parte en primarios + affordance "Otros"; el bloque de cuenta se condiciona a `showAccountSelector`.
- Lectura de categorías recientes: una query barata (las categorías de los últimos N movimientos del usuario), inyectada por el caller (web RSC / mobile).
- `apps/mobile`: el equivalente nativo hereda los mismos derivados desde el hook compartido (paridad vía contrato, sin lógica duplicada).
- `packages/i18n-messages`: copy nuevo para la affordance de tipos secundarios ("Otros movimientos" / "Ajuste" / "Cambio de moneda" ya existen como labels).
- **Sin migración, sin cambios de schema, sin cambios de mutators contables.** El riesgo es puramente de UI/estado del formulario.
- **Dependencia/orden:** las reglas contables que el form dispara ya están estables en `main` (el change `fix-recurrence-projection-and-orphans` se mergeó en `521d005`). Este change se apoya sobre ese estado y solo agrega requirements nuevos a `transactions`, sin tocar los existentes.
