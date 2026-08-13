# Diseño — Chips de clasificación frecuente (ítem #1 de #31)

Referencia del rationale original: `openspec/changes/archive/2026-08-13-simplify-movement-form-surface/design.md` (decisión **D0**) y epic **#31**.

## Objetivo

Bajar la clasificación de 2 taps a **1** (idealmente 0 gestos extra) mostrando las hojas `(categoría, subcategoría)` más frecuentes del usuario como chips de un tap, sobre el selector de categoría.

## Decisiones

### F1 — La query devuelve **hojas**, no categorías

La unidad es la hoja `(category_id, subcategory_id)` — así "Comida › Pedidos Ya" y "Comida › Super" son chips distintos, que es lo que el usuario reconoce. Se agrupa por el par, se cuenta y se ordena por frecuencia desc; desempate por uso más reciente (`max(date)`).

- **Ventana:** últimos **60 días** (`date >= hoy - 60d`). Balance entre relevancia y señal suficiente; recomendación del PO, ajustable por constante.
- **Top:** **4** chips. Entran sin scroll en el ancho mobile y evitan la "pared de chips".
- **Filtros:** `user_id = auth.uid()` (RLS ya lo fuerza), `is_parent = false` (las madres de cuotas no son clasificación de uso directo), `category_id not null`, y **compatibilidad de tipo** con el tab activo (una hoja de categoría `expense` no aparece en `ingreso`).

### F2 — Excluir taxonomía archivada

Una hoja cuya categoría o subcategoría fue archivada NO debe ofrecerse como chip (clasificar en algo archivado es un paso atrás). La query excluye por el marcador de archivado del catálogo. Como segunda barrera, el hook **filtra `frequentChips` contra el catálogo vigente que ya recibe** (`categories`): si la hoja no existe en el árbol activo, no se muestra — mismo criterio que `graftArchivedTaxonomy` usa para no romper edición.

### F3 — El hook queda I/O-free; el caller inyecta

Igual que `accounts`/`categories`: el caller (web server action + TanStack; mobile su query) resuelve `frequentClassifications` y las pasa por `UseMovementFormArgs`. El hook solo **deriva** `frequentChips` (filtra por tipo + catálogo) y expone el handler de tap, que reusa `pickCategory(catId, subId)` — cero lógica de asignación nueva.

- **Shape inyectado:** `FrequentClassification { categoryId, subcategoryId | null }` — mínimo. El icono, el nombre de la hoja y la compatibilidad de tipo se resuelven contra `categories`, que el hook ya tiene. Así la query no duplica el árbol ni se desincroniza de nombres/iconos.

### F4 — Presentación

- Fila horizontal de chips **sobre el selector de categoría** (la clasificación es la decisión principal, D7 del change anterior). Icono de categoría + label de la hoja (subcategoría si existe, si no la categoría).
- **Estado activo:** el chip cuya hoja coincide con la selección actual se marca (mismo lenguaje que los chips de cuenta/fecha del change anterior).
- **Ausencia de datos:** sin chips elegibles, no se renderiza la fila — nada de placeholders vacíos.
- **La fila de chips reemplaza a la fila "Categoría" en mobile.** Con los chips llevando el caso común arriba, el selector completo pasa a un trigger slim **"Elegir otra categoría"** debajo (abre el mismo picker con drill de subcategoría). Cuando la selección no es uno de los chips activos, ese trigger muestra la categoría elegida, así lo seleccionado siempre queda visible. Desktop conserva la fila `FieldRow` de siempre.
- **Web:** gateado por `isMobile` (mobile-web), desktop intacto. Extender al desktop es un opt-in de una línea, se decide aparte.
- **Edición:** los chips no aplican en modo edición (el tipo y la clasificación ya existen); solo en create.

### F6 — Sugerencias que rellenan (top-up), por `canonical_name`

Los chips envuelven en mobile y la última fila suele quedar con huecos; y un usuario sin historial no tendría chips justo cuando el acelerador es más valioso. Por eso el historial se **completa con clasificaciones sugeridas** hasta llenar (`FREQUENT_CHIPS_MAX`), sin repetir una hoja ya presente:

- **Gasto:** Comida › Supermercado, Entretenimiento › Salidas, Transporte, Servicios, Salud, Hogar.
- **Ingreso:** Sueldo, Freelance, Inversiones, Otros ingresos.

Las sugerencias van **después** del historial (que lidera por ser lo más relevante) y rellenan la cola. Un usuario nuevo (sin historial) ve solo sugerencias. Se referencian por **`canonical_name`** (inmutable) y no por nombre visible ni id: el label lo puede renombrar el usuario o cambiarlo i18n, y el id es por-DB. Se resuelven contra el catálogo vigente en el hook; cualquier sugerencia que el catálogo no sirva (archivada, borrada) se omite. Todo vive en el hook (I/O-free), así que web y nativo lo heredan igual.

### F5 — Qué NO hace

- No autocompleta la **cuenta** (eso es la memoria categoría→cuenta, ítem #2 de #31).
- No infiere de texto tipeado (eso es `suggestCategoryFromHistory`, ya existe; extenderla a cuenta es ítem #3).
- No rankea tabs ni cambia el orden de tipos.

## Riesgos

- **Predictibilidad:** los chips cambian con el historial. Mitigación: ventana estable (60d) + orden determinístico (frecuencia, luego recencia) → el set es estable entre aperturas cercanas.
- **Costo de query:** es una agregación por usuario sobre una ventana acotada; se mirroreará el estilo de las agregaciones existentes (spending-by-category/concentration) y su RLS. Top-N chico, sin joins pesados (los nombres/iconos salen del árbol ya cargado).
