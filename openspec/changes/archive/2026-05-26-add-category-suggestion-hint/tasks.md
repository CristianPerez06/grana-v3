# Tasks — Aviso pedagógico de categoría futura

> **Secuencia:** este cambio se monta sobre `add-category-history-suggestion` (Capa 1). NO implementar hasta que Capa 1 mergee a `main`. Branchear desde el `main` ya con Capa 1 adentro y rebasar si hace falta.

## 1. i18n

- [x] 1.1 Agregar clave `transactions.category_suggestion.hint` en `packages/i18n-messages/src/es.json` con placeholders `{description}` y `{category}` (borrador: `La próxima vez que cargues «{description}» te vamos a sugerir «{category}».`).
- [x] 1.2 Agregar la misma clave en `packages/i18n-messages/src/en.json` (borrador: `Next time you log "{description}" we'll suggest "{category}".`).

## 2. Componente de aviso

- [x] 2.1 Crear `apps/web/lib/transactions/components/category-suggestion-hint.tsx` con `CategorySuggestionHint` — recibe `description` y `categoryName`, renderiza el texto de `t('category_suggestion.hint', { description, category })` con estilo sutil/muteado (análogo a `CategorySuggestionChip` pero **no accionable**, sin `onApply`). Trunca la descripción a 40 chars.

## 3. Cableado en los forms de alta

- [x] 3.1 En `apps/web/app/(app)/transactions/new/_components/movement-form.tsx`: rastrear el resultado del lookup de blur de la Capa 1 — cuando devuelve `null`, marcar "descripción sin historial". Renderizar `CategorySuggestionHint` cuando: tipo `income`/`expense` **y** descripción normalizable **y** lookup devolvió `null` **y** `categoryId` elegido. Limpiar el flag al cambiar la descripción (antes del próximo blur) y al cambiar de tab. (El lookup del blur ya no hace early-return cuando hay categoría: corre siempre para poder armar el aviso.)
- [x] 3.2 Replicar el mismo cableado en `apps/web/app/(app)/accounts/[id]/transactions/new/_components/transaction-form.tsx`.
- [x] 3.3 Verificar que chip (Capa 1) y aviso nunca se renderizan a la vez: el chip exige `!categoryId` y el aviso exige `selectedCategory` (categoría presente) → mutuamente excluyentes por construcción.

## 4. Verificación

- [x] 4.1 QA manual en `/transactions/new`: (a) descripción nueva + categoría → aparece el aviso; (b) descripción con historial → aparece el chip, no el aviso; (c) sin categoría → sin aviso; (d) sin descripción → sin aviso; (e) transfer/ajuste/cambio → sin aviso; (f) guardar funciona igual en todos los casos. _(QA OK.)_
- [x] 4.2 Repetir QA en `/accounts/[id]/transactions/new`. _(QA OK.)_
- [x] 4.3 `pnpm --filter web exec tsc --noEmit` (limpio), `pnpm --filter web lint` (0 errores), `pnpm --filter web test` (140/140 verde).
- [x] 4.4 Higiene de specs verificada (sin placeholders `TBD`); el script `pnpm openspec:check` falla en Windows por el shell, no por contenido.
