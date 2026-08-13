## Why

El change `simplify-movement-form-surface` (archivado, mergeado en `main`) bajó el alta del gasto simple de ~7 a ~4-5 taps recortando la **superficie**. El salto final a **≤3 taps** —el headline "un tap resuelve la clasificación"— es **data-driven** y quedó en el epic **#31**. Este change ataca su **ítem #1**: los **chips de clasificación frecuente**.

Hoy clasificar cuesta 2 taps aun con la mejora de superficie (abrir el selector + elegir la categoría). Para el usuario que carga lo mismo casi todos los días —"Comida › Pedidos Ya", "Transporte › SUBE"— esos 2 taps son pura repetición. La clasificación más probable ya vive en su historial; mostrarla como un chip de un tap la vuelve **0-1 tap**.

Es el mismo principio que ya declara el repo: **"la profundidad sigue a los datos, no a un flag"**. La sugerencia por descripción (`suggestCategoryFromHistory`) ya deriva del historial; este change extiende esa lógica a las **clasificaciones-hoja más frecuentes**, sin esperar a que el usuario tipee.

## What Changes

- **Chips de clasificación frecuente sobre el selector de categoría.** El formulario muestra las clasificaciones-hoja `(categoría, subcategoría)` que el usuario usó más en una ventana reciente, como chips de un tap. Cada chip lleva el **icono de la categoría** y el label de la **hoja** (la subcategoría si existe, si no la categoría): "🍽️ Pedidos Ya". Un tap asigna categoría + subcategoría de una vez → clasificar pasa de 2 taps a **1** (0 si el usuario igual iba a tipear el monto y tocar guardar).
- **Derivado de datos, no de un flag.** La lista sale de una query nueva sobre `transactions`: hojas `(category_id, subcategory_id)` más frecuentes en los **últimos 60 días**, `is_parent=false`, top **4**, compatibles con el tipo activo (`gasto`/`ingreso`), **excluyendo taxonomía archivada**. El hook sigue I/O-free: el caller resuelve la lista y la inyecta, igual que `categories`/`accounts`.
- **Contextual y silencioso ante ausencia de datos.** Sin historial suficiente (usuario nuevo, o un tipo sin movimientos), no se muestran chips — el selector de categoría queda como está. Nunca clasifica en silencio: el chip es una sugerencia de un tap, siempre visible y editable.
- **Paridad web-mobile + nativo.** La derivación vive en `@grana/movement-form`; web (mobile-web) y la app nativa la consumen. En la web queda **gateado por breakpoint** (mobile-web), con el desktop intacto — extenderlo al desktop es un opt-in trivial que se decide aparte.

**Fuera de alcance (Non-Goals):** la **memoria categoría→cuenta** (ítem #2 de #31) y la **extensión de la sugerencia por texto a la cuenta** (ítem #3) NO entran acá. Tampoco se toca ninguna regla contable, schema ni mutator. El "tercer tab dinámico por frecuencia" ya fue descartado en el change anterior.

## Capabilities

### Modified Capabilities

- `transactions`: suma un requirement sobre la **superficie del formulario de alta** — el ofrecimiento de clasificaciones frecuentes como aceleradores de un tap, derivado del historial. No modifica ninguna regla de balance, signo, corte temporal ni el significado de `transactions.status`.

## Impact

- `packages/movement-form`: nuevo tipo `FrequentClassification`; campo opcional `frequentClassifications` en `UseMovementFormArgs`; derivado `frequentChips` (filtrado por tipo activo y catálogo vigente, hojas archivadas fuera); el tap reusa `pickCategory`. Sin I/O nuevo en el hook.
- `apps/web`: server action de lectura `frequentClassifications(type)` (agrupa `transactions` por hoja, ventana 60 días, top 4); inyección en los args del drawer vía TanStack; fila de chips sobre el selector de categoría, **gateada por `isMobile`**.
- `apps/mobile`: query equivalente + inyección en los args del formulario nativo; fila de chips nativa.
- `packages/i18n-messages`: copy si hace falta (p. ej. un rótulo "Frecuentes"), es + en con paridad.
- **Sin migración, sin cambios de schema, sin mutators contables nuevos.** La query nueva es de solo lectura y respeta la RLS existente (scoped al `user_id`). Riesgo acotado a UI/estado + una query de lectura.
- **Dependencia/orden:** se apoya en `simplify-movement-form-surface` (ya en `main`). Es el ítem #1 de #31; los ítems #2 y #3 (memoria categoría→cuenta, sugerencia→cuenta) siguen después.
