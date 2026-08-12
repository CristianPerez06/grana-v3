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

#### Auditoría de taps — alta simple en `apps/mobile` (app nativa)

El flujo nativo tiene la **misma cuenta de taps** que el web (la lógica es el hook compartido; solo cambia el chrome). Verificado en código:

| Paso | Taps | Mecánica nativa |
|------|------|-----------------|
| Abrir (FAB) | 1 | `QuickAddFab` → `router.push('/transactions/new')` (`components/transactions/QuickAddFab.tsx:13`); el alta es una **pantalla pushed** (`FormScreen`), no un drawer |
| Monto | 0 | `MovementForm.tsx:303` `autoFocus={!isEdit}` — teclado numérico al entrar |
| Tipo | 0 | default `expense` (`Segmented`) |
| Cuenta (2+) | 2 | `AccountSelectField` → `SelectField` abre `SelectSheet` + elegir fila (`form-pickers.tsx`) |
| Categoría (con subcategorías) | 3 | `CategorySelectField` → abrir sheet + entrar al drill (`setDrillId`) + elegir sub/"toda la categoría" |
| Fecha | 0 | `DateField` default hoy AR |
| Guardar | 1 | submit → `onDone` → `router.back()` (el pop es automático, sin tap extra) |

Total ~7; mejor caso 4. **Mobile-web** (el mismo `apps/web/.../movement-form.tsx` bajo breakpoint móvil) = la auditoría web de arriba (drawer + `Popover`). Los recortes del change (chips de clasificación, ocultar cuenta con una sola, subcategoría no obligatoria, orden invertido) aplican igual a las dos superficies porque atacan el hook compartido y el patrón de picker, no el chrome.

> **Revalidación (pasada actual con el PO).** La auditoría se reconfirmó leyendo el código real y se cerraron las decisiones de abajo. Cambió el modelo del chip (hoja frecuente, no categoría — D0), la partición de tipos pasó de estática a derivada de datos (D1), y se invirtió el orden categoría→cuenta (D7). El **presupuesto ≤3 taps se mantiene**; el gasto simple queda: abrir · 1 tap de chip (resuelve categoría + subcategoría + cuenta) · guardar.

## Goals / Non-Goals

**Goals:**

- **Bajar el gasto simple a ≤3 taps** (abrir · clasificación de un tap · guardar), con monto tipeado y cuenta autoresuelta — desde los ~7 actuales.
- Reducir las decisiones visibles en el camino del gasto simple sin quitar ninguna capacidad.
- Derivar la simplicidad de los datos del usuario (cantidad de cuentas, moneda, historial de clasificación), nunca de un flag ni de un modo.
- Mantener el hook I/O-free: cualquier dato nuevo (hojas frecuentes, mapa categoría→cuenta, última cuenta usada) lo inyecta el caller.
- Paridad web/mobile por contrato: los derivados nuevos viven en el hook, no se retipean por plataforma.

**Non-Goals:**

- No se toca ninguna regla contable: balance, signo por tipo, corte temporal, off-ledger de tarjeta, `transactions.status`.
- No se agregan features (presupuestos, metas, alertas) — son otros módulos.
- **La web desktop no se rediseña.** Los cambios de layout de este change (orden invertido, monto recortado, filas secundarias a una línea, chips de cuenta/categoría) son para el **viewport mobile de `apps/web` y `apps/mobile`**, y en web van **gateados por breakpoint** para preservar el desktop actual.
- No se cambia el modo edición: el tipo sigue inmutable y todos los campos editables siguen visibles.

## Decisions

> Las decisiones D0–D3 se revisaron con el PO leyendo el código. D7 (orden invertido) y D8 (peso visual por rol) son nuevas. D4/D5/D6 se confirman, con detalles agregados.

### D0 — El chip es la clasificación (hoja) más frecuente, de un tap

El alta muestra, arriba del campo de categoría, las **clasificaciones más frecuentes del usuario como chips de un tap**. Un chip NO es siempre una categoría: es la **hoja** que el usuario más repite, que puede ser una categoría a secas o una categoría + subcategoría.

- **Icono = el de la categoría; label = la hoja.** Si el usuario siempre carga Comida › Pedidos Ya, el chip dice "🍽️ Pedidos Ya": el paraguas (Comida) sobrevive en el icono, no en el texto ("comida ya ni lo veo"). Si a Transporte nunca le pone subcategoría, su chip es "🚗 Transporte".
- **Un tap setea categoría + subcategoría + cuenta habitual** (la memoria de cuenta de D3). Es el "kiosco → todo listo" en un gesto, sin introducir una dimensión de comercio/payee nueva.
- **Derivación.** Agrupar los movimientos del usuario del tipo activo por `(category_id, subcategory_id)`, rankear por **frecuencia en ventana** (~30–60 días), tomar top 4–6. Niveles mezclados conviven. El hook queda I/O-free: el caller inyecta las hojas frecuentes; el hook interseca con el catálogo activo del tab (descarta hojas archivadas/ausentes).
- **Cantidad y orden (cerrado):** 4–6 chips, por **frecuencia-en-ventana** — ni recencia pura (titila el set en cada carga) ni frecuencia histórica (queda vieja si cambia la vida del usuario). "Ver todas" para la cola.
- **Bordes.** Label ambiguo o genérico (dos subcategorías con el mismo nombre bajo distintas categorías, o una hoja tipo "Otros") → el chip cae a "Categoría › Sub" o al nombre de la categoría. Hoja archivada → no se ofrece (mismo criterio que `selectableSubcategories`).

**Subcategoría deja de ser un peaje, en todos lados.** Elegir la categoría alcanza para guardar (`subcategory_id` ya es opcional en `createExpense`). Y el **drill obligatorio del picker completo se elimina**: en "Ver todas", tocar el nombre de la categoría la asigna a secas; un chevron aparte expande las subcategorías para quien quiera refinar. Hoy tocar una categoría drillable fuerza el segundo nivel (`setCatDrill` en web / `setDrillId` en mobile); eso pasa a ser opcional. Esto vale también para el caso "la categoría que quiero no está entre los chips".

**Rationale.** El sink más caro (3 taps) es el drill obligatorio de subcategoría en la tarea más común. La gente repite pocas hojas: mostrarlas como chips convierte 3 taps en 1 para la mayoría, y la granularidad de subcategoría viaja **dentro** del chip (no se infiere en silencio) — así entra en este change sin una "memoria de subcategoría" aparte ni riesgo de ensuciar el breakdown.

### D1 — Tercer tipo dinámico, derivado de datos (reemplaza la partición estática)

La versión anterior congelaba la partición (primarios fijos = gasto/ingreso/transferencia; secundarios = ajuste/cambio). Se reemplaza por una **derivada de los datos del usuario**, que es más fiel al principio "la profundidad sigue a los datos, no a un flag":

- **Gasto e Ingreso quedan anclados** y en posición fija (los usa todo el mundo; gasto es el default).
- **El tercer lugar primario es dinámico:** el más usado **entre los elegibles** de {Transferencia, Cambio}. El otro cae en "Otros".
- **Ajuste siempre en "Otros".** Corrige un saldo desviado: es mantenimiento, no un verbo diario. Nunca compite por el slot primario.
- **Elegibilidad primero.** Transferencia requiere ≥2 cuentas propias; Cambio requiere capacidad bimoneda (una cuenta ARS+USD, o dos cuentas de monedas distintas). Un usuario con una sola Billetera ARS **no ve tercer slot ni "Otros"**: solo Gasto/Ingreso. Es el estado más simple, caído de los datos (misma lógica que ocultar la cuenta).
- **"Otros" aparece solo si hay ≥1 secundario elegible**, y en posición fija, para que los verbos "escondidos" tengan una casa estable a un tap.
- **Predictibilidad (el costo, y sus mitigaciones):** solo se mueve el tercer chip; Gasto/Ingreso nunca cambian de lugar; se recalcula en **cadencia lenta** (por sesión/día, no en vivo mientras se carga) para que no titile.
- **Cold-start:** sin secundarios elegibles → sin tercer slot; empate con ambos elegibles y sin historial → default **Transferencia** (es lo de hoy; se autocorrige a Cambio con el uso, y el costo de errar es un tap de "Otros" hasta que el historial manda).

No cambia nada contable: los cinco tipos siguen existiendo y funcionando; esto solo gobierna cuáles se muestran como primarios vs detrás de "Otros".

### D2 — Ocultar la cuenta se deriva de la elegibilidad por tipo Y moneda

Cuando, **para la moneda activa**, hay una sola cuenta elegible, el hook expone `showAccountSelector = false` y el caller no renderiza el bloque de cuenta; la cuenta queda implícita. Con ≥2, se muestra.

- **Elegibilidad = tipo Y moneda.** Ej.: Billetera (ARS) + una cuenta USD. Para un gasto en ARS hay una sola elegible; para uno en USD, una sola. El selector se oculta en ambos, y **la desambiguación la hace el toggle ARS/USD del hero del monto** — elegís moneda, la cuenta cae sola. La dimensión "cuenta" se colapsa dentro de la de "moneda", que ya estás tocando.
- **Con 2+ elegibles:** en vez de fila-que-abre-popover (2 taps), **chips de cuenta inline** (avatar + nombre; 1 tap, 0 si el default acierta) cuando son pocas; con muchas, cae al row + popover, y ahí el split **crédito vs débito/efvo** va como encabezados de sección (estructura útil: se comportan distinto — off-ledger, cuotas), sin sumar un tap de filtro.
- **La cuenta es un override,** no la decisión principal: la categoría ya la setea (D3). Por eso el bloque puede ser liviano y optimizarse por claridad, no por taps.
- **Cuidado (se mantiene).** "Una sola elegible" ≠ "una sola cuenta". En transferencia hacen falta ≥2 propias; con una sola, el flujo no aplica (se maneja aparte).

### D3 — Memoria categoría→cuenta; preselección derivada

Elegir una categoría (chip o picker) **autocompleta la cuenta/tarjeta más usada para esa clasificación**, tomada del historial. Reemplaza el default `firstFor(tab)` de hoy como preselección principal.

- **La cuenta inferida se muestra** ("Se debita de · Naranja"), tappable para cambiar. Inferir en silencio y errar la cuenta sería peor que preguntar: la memoria acelera, no decide a ciegas.
- **La tarjeta es un destino válido** ("Almacén lo pago con la Naranja") — y ahí aparece la card de cuotas, coherente.
- **Orden de preselección de `accountId` en create** (cuando la categoría no alcanza para decidir): (1) `preselectAccountId` (viene de una vista de cuenta); (2) memoria categoría→cuenta, si existe para esa clasificación; (3) única elegible; (4) última usada, si el caller la provee; (5) primera elegible (fallback actual). Nunca elige una cuenta no elegible para el tipo/moneda activos.
- **Datos.** El caller inyecta un mapa `clasificación → cuenta-más-usada` (query barata; el hook sigue I/O-free). Es una pieza más que la lista de hojas frecuentes, mismo patrón.

### D4 — El invariante de secciones avanzadas es anti-regresión

Reintegro, compartido, repetir y cuotas ya arrancan colapsadas. Fijarlo como requirement evita que un rediseño futuro (o un merge distraído) las ponga en el camino del gasto simple. No hay cambio de código si el estado actual ya lo cumple; el valor es el test/scenario que lo pinta. La presentación de la Capa 1 (una fila "Agregar…" con chips que expanden inline) se diseña aparte.

### D5 — Monto primero, con autofocus; card recortada en mobile-web

El monto se queda primero, con autofocus. Un usuario de Mobills pidió descripción-antes-que-monto (carga mientras compra); verdict: más edge case que hábito mayoritario, amplificado por sesgo de feedback. El monto es el único campo siempre obligatorio, es el número héroe y abre teclado numérico; anteponer texto libre opcional le cobra a la mayoría y rompe el presupuesto de ≤3 taps. La necesidad válida ("capturo mientras compro, monto al final") se atiende mejor con **captura en borrador** (change propio, fuera de alcance).

**Agregado esta pasada (tamaño):** en mobile-web (gateado por breakpoint; el desktop no se toca) la card del monto se **recorta** — menos padding vertical y número más chico (~34–38px vs 46px) — para que la fila de chips de categoría entre **sin scroll** con el teclado numérico abierto. Sigue siendo el número héroe; deja de comerse media pantalla. Descartado un preferencia de "orden de campos" por usuario (es un modo de usuario, prohibido en `AGENTS.md`).

### D6 — Descripción opcional; dos aceleradores; fila liviana

La descripción SIGUE opcional: nunca bloquea el guardado ni es requisito para clasificar. Volverla obligatoria le cobraría fricción a todas las cargas (incluidas las que los chips resuelven en un tap) y produciría descripciones basura que ensucian el historial de sugerencias.

**Dos aceleradores coexisten, el usuario elige por comportamiento:** (1) sin descripción → chips (D0), un tap resuelve clasificación + cuenta; (2) con descripción → sugerencia (`suggestCategoryFromHistory`) al tipear un comercio conocido. La extensión natural es que esa sugerencia también traiga la **cuenta** habitual del texto (se apoya en la memoria de D3) — ver Open Questions.

**Agregado esta pasada (posición y tamaño):** en el orden invertido (D7) la descripción cae al fondo (arriba de lo avanzado) y se **adelgaza a una sola línea** (sin recuadro de icono ni label en mayúsculas). No se esconde detrás de un tap ("+ Nota" que se expande): al que prefiere tipear el comercio no le cobramos un gesto.

### D7 — Orden invertido: categoría antes que cuenta (nueva)

Como la categoría ahora maneja la cuenta (D3), la categoría es la decisión principal y va **antes** que la cuenta. Orden vertical del alta en create:

1. Tipo (tabs) · 2. Monto (recortado) · 3. **Categoría (chips + "Ver todas")** · 4. Cuenta (derivada; oculta si hay una sola elegible; si no, override liviano) · 5. Fecha · 6. Descripción (opcional) · 7. Avanzado (colapsado, Capa 1).

Reemplaza el orden actual (web: cuenta arriba de categoría; mobile: categoría abajo del todo, después de fecha/descripción). Es solo presentación — ninguna regla contable cambia. En edición no aplica (los campos editables mantienen su tratamiento).

### D8 — El peso visual sigue al rol del campo (nueva)

Monto = héroe (recortado). Chips de categoría = la acción principal. Los campos secundarios (cuenta-override, fecha, descripción) van con tratamiento **de una sola línea**: sin recuadro de icono de 36px, sin label en mayúsculas. Declutterea y sube lo importante arriba del fold.

- **Fecha:** una línea con el valor al frente ("📅 Hoy · mar 11 ago ›"); el label "FECHA" es redundante (el valor ya se lee como fecha). Sigue en 0 taps.
- **Descripción:** una línea con placeholder ("Agregá una nota (opcional)"), visible (no tap-to-expand).

Es una regla general para las filas secundarias, no ad-hoc por campo. Todo gateado por breakpoint: el desktop conserva su tratamiento actual (recuadros de icono + labels en mayúsculas).

### D9 — Capa 1: funcionalidades avanzadas como chips de activación en el lugar (nueva)

Reintegro, compartir y repetir dejan de ser tres toggles gordos siempre visibles (icono + título + subtítulo + switch, `togglesGroup` en `movement-form.tsx:1287`) y pasan a una **fila slim de chips de activación**. Tocar un chip **activa la funcionalidad** (equivale al switch de hoy) y **despliega sus parámetros inline** debajo; tocarlo de nuevo la apaga y colapsa. "Primero la intención, después el detalle."

- **La fila es contextual (1–3 chips), no siempre tres.** Repetir: en `gasto` no-cuotas / `ingreso` / `transferencia`. Reintegro: en `gasto`. Compartir: en `gasto` con hogar de 2. Si no aplica ninguno (`ajuste`/`cambio`), no hay fila. Son los gates que ya existen (`showReimbursementToggle`, `showSharedToggle`, `showRepeatToggle`, `!isInstallments`) — presentación, no lógica nueva.
- **Params sin cambios**, con sus defaults sanos: compartir = 50/50; repetir = mensual; reintegro = monto (+ %/tope, target radio en crédito, cuenta destino, recibido-ahora). Cada feature paga solo su mínimo; el gasto simple no toca ninguna.
- **Chips a la vista, sin envoltorio "Más opciones" (decisión de PO).** Se eligió la fila slim siempre visible (0 tap extra para activar, misma cuenta que hoy) por sobre colapsar todo detrás de "Más opciones" (+1 tap). Reclama casi el mismo espacio —una fila flaca vs tres gordas— y mantiene el CTA arriba del fold.
- **Cuotas NO está en esta fila.** Es parte de la **forma de pago**, no un add-on: sigue apareciendo pegada al bloque de cuenta cuando la cuenta es tarjeta (chips [1,3,6,12] + "Otras" en ARS; pago único en USD). Como la memoria categoría→cuenta (D3) puede setear una tarjeta, cuotas aparece ahí, coherente.
- Refuerza el invariante de D4 (nada de esto en el camino del gasto simple). Presentación-only; mismos gates; en web gateado por breakpoint (el desktop conserva el `togglesGroup` actual).

## Risks / Trade-offs

- **Predictibilidad del tercer tab (D1).** Que el tercer verbo cambie de identidad puede desorientar. Mitigación: Gasto/Ingreso fijos, solo se mueve el tercer chip, recálculo en cadencia lenta, "Otros" con casa estable.
- **Cuenta inferida equivocada (D3).** La memoria puede errar. Mitigación: la cuenta inferida siempre se muestra y es tappable; nunca se infiere en silencio.
- **Descubribilidad de `ajuste`/`cambio`.** Bajarles el peso puede costar un segundo. Mitigación: "Otros" visible y de un tap; no se esconden en un menú profundo.
- **Paridad mobile.** Todo derivado nuevo (hojas frecuentes, `showAccountSelector`, tercer tab, mapa de cuenta) vive en el hook; si mobile no lo lee, TypeScript no lo obliga (son datos, no tipos). Mitigación: el scenario de paridad y una nota en el contrato.

## Open Questions

- **Dimensión comercio/payee.** Sigue parkeada como decisión de producto. El modelo de chip-como-hoja (D0) cubre buena parte del caso "Pedidos Ya" **sin** crear la dimensión, mientras el usuario lo modele como subcategoría. Un comercio de primera clase (con su propia categoría/cuenta) sigue fuera de alcance.
- **Cadencia exacta de recálculo** del tercer tab (D1) y de las hojas frecuentes (D0): "por sesión/día" es la intención; el punto fino (memoizar por request RSC en web / query key en mobile) se resuelve en implementación.
- **Extender `suggestCategoryFromHistory` para traer también la cuenta** del texto (D6/D3): cae casi solo sobre la memoria de cuenta; decidir si entra en este change o en uno de seguimiento.

**Cerradas esta pasada** (salían de Open Questions): cantidad de chips y recencia-vs-frecuencia → 4–6 por frecuencia-en-ventana (D0); memoria de subcategoría separada → disuelta, viaja dentro del chip-hoja (D0); adoptar "última cuenta usada" → sí, dentro del orden de preselección, detrás de la memoria categoría→cuenta (D3); "Otros" como pestaña o link → affordance de un tap que aparece solo con secundario elegible (D1).
