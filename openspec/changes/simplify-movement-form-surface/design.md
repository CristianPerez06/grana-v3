## Context

El alta de movimientos vive en un hook cross-platform (`@grana/movement-form`) que web y mobile bindean a sus acciones. Hoy expone `tab: 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'` y web lo renderiza con un `<Segmented>` de cinco opciones de igual peso (`movement-form.tsx:778`). Las secciones avanzadas (reintegro, compartido, repetir, cuotas) ya se renderizan colapsadas detrás de toggles/cards. El default de cuenta en create es `firstFor(tab)` — la primera cuenta elegible, no la última usada ni la más probable.

El principio rector ya está escrito en `AGENTS.md`: *"perfil único (sin modos de usuario); la profundidad sigue a los datos, no a un flag guardado. Un usuario que mantiene todo en la `Billetera` por defecto obtiene la experiencia simple; crear más cuentas hace aparecer la dimensión cuenta."* La lista de cuentas ya cumple esto. El formulario todavía no.

### Auditoría de taps (estado actual en `main`)

Tarea "cargar un gasto simple" en cuenta cash/bank:

| Paso | Taps | Mecánica actual |
|------|------|-----------------|
| Abrir drawer (FAB) | 1 | — |
| Monto | 0 | `amountRef.current?.focus()` (`movement-form.tsx:446`) autoenfoca al abrir |
| Tipo | 0 | `initialTab = 'expense'` es el default |
| Cuenta (2+) | 2 | `FieldRow` → `Popover` de cuentas (abrir + elegir) |
| Categoría (con subcategorías) | 3 | `FieldRow` → `Popover`; una categoría "drillable" entra al segundo nivel (`setCatDrill`) y recién ahí se elige sub o "toda la categoría" |
| Fecha | 0 | default hoy AR |
| Guardar | 1 | — |

Total ~7 taps; mejor caso 4 (una sola cuenta + categoría sin subcategorías). El chip de sugerencia por descripción (`CategorySuggestionChip`) ya existe y baja categoría a 1 tap **cuando** el usuario tipeó una descripción con historial — no es el camino por defecto.

**Wins ya ganados (no re-descubrir):** autofocus del monto, default de fecha hoy, moneda por cuenta, y el chip de sugerencia por descripción. Este change ataca lo que queda: categoría y cuenta.

## Goals / Non-Goals

**Goals:**

- **Bajar el gasto simple a ≤3 taps** (abrir · categoría de un tap · guardar), con monto tipeado y cuenta autoresuelta — desde los ~7 actuales.
- Reducir las decisiones visibles en el camino del gasto simple sin quitar ninguna capacidad.
- Derivar la simplicidad de los datos del usuario (cantidad de cuentas, contexto de origen), nunca de un flag ni de un modo.
- Mantener el hook I/O-free: cualquier dato nuevo (última cuenta usada) lo inyecta el caller.
- Paridad web/mobile por contrato: los derivados nuevos viven en el hook, no se retipean por plataforma.

**Non-Goals:**

- No se toca ninguna regla contable: balance, signo por tipo, corte temporal, off-ledger de tarjeta, `transactions.status`.
- No se agregan features (presupuestos, metas, alertas) — son otros módulos.
- No se rediseña el layout visual del drawer; solo cambia qué se muestra por defecto y el peso relativo de los tipos.
- No se cambia el modo edición: el tipo sigue inmutable y todos los campos editables siguen visibles.

## Decisions

### D0 — Categoría de un tap con chips de recientes (el recorte principal)

El alta muestra las categorías recientes/frecuentes del usuario como chips de selección directa arriba del campo de categoría. Un tap sobre un chip clasifica y no abre nada. El `FieldRow` de categoría pasa a ser "Ver todas" y conserva el picker completo con drill para el resto.

**Rationale.** El drill obligatorio de subcategoría es el sink más caro (3 taps) en la tarea más común. La gente repite pocas categorías: mostrar sus recientes como chips convierte 3 taps en 1 para la mayoría de los gastos. Es exactamente el patrón de grilla de íconos de Mobills, pero alimentado por el historial del usuario en vez de una grilla fija.

**Subcategoría deja de ser obligatoria en el camino rápido.** Elegir la categoría (chip o tile) alcanza para guardar; la subcategoría queda como refinamiento opcional desde "Ver todas". Esto ya es válido en el dominio (`subcategory_id` es opcional en `createExpense`), así que no cambia ninguna regla — solo deja de forzar el segundo nivel.

**El hook queda I/O-free.** El caller inyecta `recentCategoryIds` (una query barata: categorías distintas de los últimos N movimientos del usuario, del tipo activo). El hook deriva `quickCategories` intersecando con el catálogo activo del tab. Si el usuario no tiene historial (primer movimiento), no hay chips y el flujo cae al picker completo — coherente con el tour de `guidance` para el primer movimiento.

**Qué lleva el chip (nivel).** El chip puede clasificar solo la categoría (nivel 1) o resolver también la cuenta habitual (nivel 2). Se adopta **nivel 2**: un chip pone categoría **+ cuenta más usada para esa categoría**, de modo que el "kiosco → categoría + cuenta" ocurre en un tap sin tipear. El label del chip es la categoría ("Almacén", "Transporte"), no el comercio ("Kiosco") — un chip con nombre de comercio implicaría una dimensión de comercio/payee que Grana hoy no tiene (ver Open Questions).

**Decisión de PO pendiente:** ¿cuántos chips (3, 5)? ¿recientes puros u ordenados por frecuencia? Arranco con "hasta 5, por recencia".

### D1 — Tipos primarios vs secundarios, no un flag

`gasto`, `ingreso`, `transferencia` son primarios; `ajuste` y `cambio` secundarios, detrás de una affordance "Otros". La partición es **estática** (deriva de la naturaleza del tipo, no del usuario), así que vive como una constante en el hook (`PRIMARY_TABS` / `SECONDARY_TABS`) y ambas plataformas la consumen.

**Rationale.** `ajuste` corrige un saldo que se desvió y `cambio` convierte entre monedas: son operaciones de mantenimiento, no de registro diario. Bajarles el peso visual no las esconde (un tap las trae) pero limpia la decisión primaria de 5 a 3.

**Alternativa descartada.** Ocultar los secundarios según frecuencia de uso del usuario: agrega estado y un borde ("¿cuándo reaparecen?") sin beneficio claro. La partición estática es predecible.

### D2 — Ocultar la dimensión cuenta se deriva de `eligibleAccounts`

Cuando `eligibleAccounts.length === 1`, el hook expone `showAccountSelector = false` y el caller no renderiza el bloque de cuenta; la cuenta implícita es esa única. Con ≥2, se muestra como hoy.

**Rationale.** Es exactamente la regla que la lista de cuentas ya aplica, movida al formulario. Coherente con el principio single-profile. La elegibilidad ya depende del tab (`gasto` puede apuntar a crédito; el resto no), así que "una sola elegible" puede variar por tab — el derivado se recalcula por render, sin estado extra.

**Cuidado.** No confundir "una sola cuenta elegible" con "una sola cuenta". En el tab `transferencia` hacen falta ≥2 cuentas propias; si hay una sola, el flujo de transferencia ya no aplica y eso se maneja por separado (no es parte de este change).

### D3 — Preselección de cuenta: decisión de PO

Orden de preferencia propuesto para el default de `accountId` en create:

1. `preselectAccountId` (viene de una vista de cuenta) — ya existe.
2. La única elegible, si hay una sola.
3. **Última cuenta usada** por el usuario en un movimiento de ese tipo — *propuesto*.
4. Fallback: primera elegible (comportamiento actual).

El paso 3 requiere que el caller lea la última cuenta usada (una query barata: el `account_id` del movimiento más reciente del usuario) y la pase como `lastUsedAccountId`. El hook queda I/O-free.

**Decisión de PO pendiente:** ¿adoptamos "última usada" (paso 3) o alcanza con 1-2-4? "Última usada" acierta más seguido para quien tiene 2-3 cuentas, a cambio de una lectura extra y de un default menos predecible. Si el PO prefiere no agregar la query, se implementan solo 1-2-4 y el requirement de preselección se cumple igual.

### D4 — El invariante de secciones avanzadas es anti-regresión

Reintegro, compartido, repetir y cuotas ya arrancan colapsadas. Fijarlo como requirement evita que un rediseño futuro (o un merge distraído) las ponga en el camino del gasto simple. No hay cambio de código si el estado actual ya lo cumple; el valor es el test/scenario que lo pinta.

### D5 — Orden de campos: monto primero (confirmado)

Un usuario de Mobills pidió **descripción antes que monto**, porque carga mientras compra y a veces el monto es lo último que sabe. Verdict: **el monto se queda primero**, con autofocus.

**Rationale.** Es más edge case que hábito mayoritario, amplificado por sesgo de feedback (el que más opina es el power-user que carga en el pasillo; la mediana carga después de pagar, con el monto ya sabido). El monto es el único campo siempre obligatorio, es el número héroe y abre teclado numérico; anteponer texto libre opcional le cobra a la mayoría (teclado de texto → cambiar a numérico) y rompe el presupuesto de ≤3 taps. La propia Mobills es monto-primero (a confirmar en hands-on).

**Pero la necesidad es válida y se honra sin reordenar:** (1) el drawer es scrolleable — nada bloquea empezar por descripción; solo hay que garantizar que la descripción sea alcanzable sin scroll. (2) El caso "capturo mientras compro, monto al final" se resuelve mejor con **captura en borrador** (guardar incompleto, completar el monto en la caja) que con un reorden estático — candidato a change propio, fuera de este alcance.

**Descartado:** un preferencia de "orden de campos" por usuario — es un modo de usuario, y `AGENTS.md` los prohíbe ("la profundidad sigue a los datos, no a un flag").

### D6 — Descripción opcional; dos aceleradores, no un campo obligatorio

**Decisión:** la descripción SIGUE opcional. Se descartó volverla obligatoria para forzar auto-clasificación (categoría/subcategoría/cuenta).

**Rationale.** Volver obligatorio un campo para habilitar una comodidad le cobra fricción a todas las cargas —incluidas las que los chips ya resuelven en un tap— y produce descripciones basura ("varios", ".") que ensucian el historial que alimenta las sugerencias. Las categorías ya son suficientemente descriptivas para la mayoría.

**Dos aceleradores coexisten, el usuario elige por comportamiento:**

1. **Sin descripción → chips de categoría** (D0, nivel 2): un tap resuelve categoría + cuenta habitual.
2. **Con descripción → sugerencia** (`suggestCategoryFromHistory`): tipear un comercio conocido ("kiosco") prefiltra la clasificación. Hoy devuelve categoría + subcategoría (`packages/money-logic/src/category-suggestion.ts`); **la extensión natural es que también recuerde la cuenta habitual** para ese texto, completando el "kiosco → categoría + cuenta" para quien tipea.

Ninguno bloquea al otro ni introduce un modo: son dos puertas al mismo resultado.

## Risks / Trade-offs

- **Descubribilidad de `ajuste`/`cambio`.** Bajarles el peso puede hacer que un usuario que los busca tarde un segundo más. Mitigación: la affordance "Otros" es visible y de un solo tap; no se esconden en un menú profundo.
- **Default menos predecible con "última usada".** Ver D3: es opt-in del PO; si molesta, se queda en "primera elegible".
- **Paridad mobile.** Todo derivado nuevo vive en el hook; si mobile no lee `showAccountSelector`/la partición, TypeScript no lo obliga (son datos, no tipos). Mitigación: el scenario de paridad y una nota en el contrato.

## Open Questions

- **Dimensión comercio/payee.** ¿Grana desarrolla el comercio como concepto de primera clase (chips/labels que digan "Kiosco", "Carrefour", con su categoría y cuenta asociadas), o la clasificación se queda a nivel categoría? Es la decisión que separa el nivel 2 del nivel 3 de los chips, y excede este change. Requiere decisión de producto antes de comprometerla.
- ¿Se extiende `suggestCategoryFromHistory` para devolver también la cuenta habitual del texto? (Enhancement acotado, alto valor; decidir si entra en este change o en uno de seguimiento.)
- D0: cantidad de chips (3 vs 5) y orden (recencia vs frecuencia). Arranco con 5 por recencia.
- ¿"Otros" como pestaña extra dentro del `Segmented`, o como un link/acción aparte debajo? (UI, no contrato — se resuelve en implementación.)
- D3: adoptar o no "última cuenta usada".
