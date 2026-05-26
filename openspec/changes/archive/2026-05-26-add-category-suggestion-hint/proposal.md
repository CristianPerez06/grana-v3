# Aviso pedagógico: "la próxima vez te sugerimos esta categoría"

## Why

La Capa 1 del autocategorizador (`add-category-history-suggestion`, ya archivada) sugiere una categoría cuando la descripción del movimiento coincide con una transacción anterior. Tiene un problema de arranque en frío: **la primera vez** que el usuario carga una descripción nueva no hay nada que sugerir, así que la feature es invisible hasta que el usuario, por casualidad, repite una descripción y descubre el chip.

Decidimos NO resolver ese arranque en frío con un diccionario de keywords (la "Capa 2" que se evaluó y se descartó: mantenimiento permanente, sesgo cultural AR, y el riesgo de adivinar mal choca con el pilar de confianza contable). En su lugar, lo resolvemos **enseñando**: cuando el usuario categoriza por primera vez una descripción nueva, le mostramos un aviso suave de que la próxima vez se la vamos a sugerir.

Esto cierra el círculo de la Capa 1 (chip = el premio; aviso = la promesa que lo anticipa) y, de paso, le da al usuario un motivo para escribir descripciones: cuantas más descripciones cargue, más aprende el sugeridor de historial. Es la forma barata y alineada con el pilar "sugiere y enseña, nunca condesciende" de cubrir el cold-start.

## What Changes

- Al registrar un **ingreso o gasto**, cuando el usuario elige una categoría para una descripción que **no tenía historial** (la búsqueda de la Capa 1 devolvió vacío), el formulario muestra un **aviso informativo, no bloqueante**: la próxima vez que cargue esa descripción se le va a sugerir esa categoría.
- El aviso es **mutuamente excluyente con el chip de la Capa 1**: el chip aparece cuando SÍ hay coincidencia; el aviso, cuando NO la hay. Nunca se ven juntos.
- Reutiliza la búsqueda que la Capa 1 ya hace en el blur de la descripción (`suggestCategoryFromHistory`): si devolvió `null` (descripción nueva) y después el usuario elige categoría → se muestra el aviso. **No agrega ninguna consulta ni server action nueva.**
- Es **solo presentación**: no toca el ledger, no cambia el guardado, no persiste nada, no agrega columnas ni migraciones. Solo aplica a `income`/`expense` (los únicos tipos con categoría).
- Alcance: formularios de alta web (`/transactions/new` y `/accounts/[id]/transactions/new`). Paridad mobile fuera de alcance (transactions aún no existe en mobile).

## Capabilities

- `transactions` (MODIFIED): se agrega un requirement complementario al de "sugerencia según historial".

## Impact

- **Depende de** `add-category-history-suggestion` (Capa 1): reutiliza su búsqueda de blur, su normalización y su cableado en los dos forms. La implementación de este cambio DEBE hacerse después de que Capa 1 mergee a `main`.
- Archivos tocados (en implementación): los dos forms de alta (`movement-form.tsx`, `transaction-form.tsx`), un componente de aviso nuevo análogo a `CategorySuggestionChip`, y una clave i18n nueva en `es.json`/`en.json`. Sin cambios en server actions, validación, esquema ni `@grana/money-logic`.
- Riesgo: bajo. Es texto informativo; el peor caso es ruido visual, mitigado por mostrarlo solo para descripciones nuevas y con estilo sutil.
