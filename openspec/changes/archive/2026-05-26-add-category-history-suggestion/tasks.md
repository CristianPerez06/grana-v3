> ⚠️ **Secuencia:** implementar **después** de mergear `add-currency-exchange` (Fase 2) y de rebasar sobre el `main` actual. Ambos tocan los forms de alta (`movement-form.tsx`, alta por-cuenta), que además main ya re-i18n-izó. Construir sobre el form final evita conflictos.

## 1. Query de sugerencia

- [x] 1.1 `suggestCategoryFromHistory(description, type)` → server action `app/_actions/category-suggestion.ts` (usa helpers puros de `lib/transactions/category-suggestion.ts`): normaliza, busca última tx con `description ILIKE <normalizado>`, `category_id` no nulo, `is_parent=false`, `created_at DESC LIMIT 1`, valida tipo; devuelve `CategorySuggestion | null`.
- [x] 1.2 Tests de los helpers puros (`normalizeDescription`, `categoryTypeMatches`): 6/6 OK.

## 2. UI del chip

- [x] 2.1 Componente `CategorySuggestionChip` (`lib/transactions/components/`): chip no bloqueante con ícono, "¿{Categoría}? · la última vez lo pusiste ahí"; al tocar aplica categoría (+subcategoría).
- [x] 2.2 Integrado en el form global (`movement-form.tsx`): blur en descripción (income/expense, sin categoría elegida) → pide sugerencia; chip arriba del select de categoría; se limpia al cambiar tab/descripción/categoría.
- [x] 2.3 Integrado en el alta por-cuenta (`transaction-form.tsx`) con la misma lógica.
- [x] 2.4 Claves i18n `category_suggestion.chip` (es/en).

## 3. Verificación y cierre

- [x] 3.1 `tsc --noEmit` (0) + `lint` (0 errores) + tests (140, incl. 6 nuevos del helper).
- [x] 3.2 QA runtime: descripción repetida sugiere la categoría correcta; aplica al tocar; no se autocompleta; tipo coincide; sin historial no sugiere; no aparece en transfer/ajuste/cambio. Probado por el usuario: todo OK.
- [x] 3.3 Archivar el change y aplicar el delta al master spec `openspec/specs/transactions/spec.md`.
