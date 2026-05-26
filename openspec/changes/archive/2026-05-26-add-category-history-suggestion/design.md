## Context

v3 no tiene autocategorizador: el campo categoría se llena a mano siempre. v2 lo resolvía con 2 capas (`getCategorySuggestion.ts`): Capa 1 historial (query: última tx con la misma descripción normalizada → su categoría/subcategoría, validando que el tipo coincida) y Capa 2 keywords (diccionario por `canonical_name`). v3 ya tiene `canonical_name` en categorías (migraciones 0005/0006), así que la Capa 2 es portable — pero queda para otro change.

El campo descripción ya se guarda en `transactions.description`. Los flujos de alta de ingreso/gasto viven en el form global (`movement-form.tsx`) y el alta por-cuenta (`transaction-form.tsx`).

## Goals / Non-Goals

**Goals:**
- Reducir la fricción de categorizar con una sugerencia **personalizada y honesta** (lo que el usuario mismo hizo).
- Respetar el pilar: sugerir y explicar, no imponer.

**Non-Goals:**
- Capa 2 (diccionario de keywords) — change aparte.
- Auto-completar la categoría (se descarta: impone).
- Match fuzzy/aproximado (arrancamos exacto).
- Mobile (replica después con la misma query).

## Decisions

- **D1 — Solo Capa 1 (historial).** Barata (1 query, sin diccionario), personalizada, mejora con el uso, cero mantenimiento. Cubre el caso de descripciones repetidas, que es el grueso de la fricción.
- **D2 — Chip sugerido, no auto-fill.** Pilar "sugiere y enseña, nunca impone": un chip *"¿{Categoría}? · la última vez lo pusiste ahí"*; tocarlo aplica categoría (+subcategoría); ignorarlo no hace nada. El "porqué" es el *enseñar*.
- **D3 — Match exacto normalizado.** `description` normalizada a lowercase+trim; `ILIKE` exacto (sin wildcards) contra el historial del user; `ORDER BY created_at DESC LIMIT 1`; `category_id` no nulo; `is_parent=false`; el tipo de la categoría debe ser compatible con el tipo del movimiento (income/expense). Predecible y simple; fuzzy queda para más adelante si hace falta.
- **D4 — Disparo y visibilidad.** Al salir del campo descripción (blur). El chip se muestra solo si hay sugerencia **y** el usuario no eligió categoría todavía (no molesta si ya eligió).
- **D5 — Dónde vive.** Query como server action `suggestCategoryFromHistory(description, type)` (o función en `apps/web/lib/transactions/`). El chip se integra en el campo categoría de los forms de alta. Mobile replicará la query en su `lib/`.
- **D6 — Alcance.** Solo ingreso/gasto (los únicos con categoría).

## Risks / Trade-offs

- **[Cold-start: vacío hasta tener historial]** → Es lo esperado de la Capa 1; la Capa 2 (keywords) cubre el día 1 y llega en otro change. Aceptable.
- **[Una query por blur de descripción]** → Barata: scope RLS al user, `LIMIT 1`. `description` no está indexada; si se nota lento, agregar índice. No bloqueante.
- **[Secuencia con Fase 2 y el churn de main]** → Implementar **después** de mergear `add-currency-exchange`: ambos tocan los forms de alta, y main re-i18n-izó esos forms + renombró keys/rutas. Construir sobre el form final evita conflictos y trabajo doble.

## Open Questions

- Copy exacto del chip (i18n) y si muestra la subcategoría en el texto.
- ¿El chip también en el flujo de **edición**, o solo en alta? (Propuesta: solo alta.)
- ¿Debounce mientras se tipea en vez de blur? (Propuesta: blur para v1.)
