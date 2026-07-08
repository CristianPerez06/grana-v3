## El caso

"Pagué yo, pero es 100% del otro." Ej.: le pago la nafta a mi pareja y me la devuelve. No es un gasto mío repartido; es un gasto **enteramente suyo** que yo adelanté.

## Por qué un split 0/100 y no un concepto nuevo

El motor de deuda ya deriva todo de los splits (`shared_expense_split.amount_assigned`) menos las liquidaciones. Un split `{vos: 0%, otro: 100%}` expresa exactamente el caso:

```
computeHouseholdBalances (money-logic/shared.ts:121-133)
  fila pagador (memberId === ownerId)  → continue        // tu parte no genera deuda
  fila otro     (100% = total)         → el otro te debe el total
```

Inventar un tipo/flag nuevo ("préstamo", "pagué por X") duplicaría maquinaria que ya existe y funciona. El 0/100 reusa deuda, cuenta corriente, reintegros, proyección y desglose **sin una línea de lógica nueva**. Los únicos obstáculos son tres *guardas de input* que asumían `≥ 1`.

## Las tres guardas y por qué se relajan juntas

```
  UI clamp 1..99  ──┐
  yup .min(1)     ──┼──  las tres deben ceder o el 0/100 se rechaza en algún punto
  DB check 1..100 ──┘
```

- **DB → `between 0 and 100`**: sin esto, Postgres rechaza la fila del 0%.
- **yup → `.min(0)`**: sin esto, el schema rechaza el input. `sum === 100` + `min(2)` siguen bloqueando lo degenerado.
- **UI → toggle** (no simplemente `clamp 0..100`): ver abajo.

## Por qué toggle y no "campo % libre 0..100"

Un `0%` mudo no comunica nada. El toggle **"Lo pagué yo, pero es 100% de {nombre}" · "Te queda debiendo el total"** convierte el caso de borde en algo que se entiende sin pensar, y es **aditivo**: el editor de reparto normal (1..99) queda intacto, así que el caso común (mitad y mitad) no se toca. Se descartó "presets + custom" por ser un rediseño del editor para resolver un borde.

El toggle vive dentro del bloque de split ya existente (`movement-form.tsx:1379-1415`), que es compartido por alta y edición — así aparece en ambos flujos sin duplicar.

## Alcance del split 0/100: por-gasto, no por-defecto

`sharedSplitSchema` lo comparten el split por-gasto y el `default_split` del hogar. Relajamos el schema (afecta ambos a nivel validación), pero **el editor del default sigue clampeado 1..99** (`default-split-edit-drawer.tsx:101`): un hogar cuyo *default* es 0/100 no es un caso de uso. El check de DB, además, solo aplica a los splits por-gasto (el default es JSON), así que la relajación de la base es naturalmente por-gasto.

## La categoría del otro: qué resuelve y qué no

El desglose del otro agrupa por el `category_id` que eligió el pagador. Categorías = **system** (`user_id IS NULL`, compartidas) o **propias** (privadas, RLS tapa las ajenas).

- Categoría **del sistema** → el otro la ve con nombre. Caso natural para un "100% tuyo". ✓
- Categoría **privada del pagador** → el otro ve el monto pero no el nombre (cae en un slice sin resolver). Degradación menor, no contaminación.

Decisión: documentar la recomendación (usar categoría del sistema) y **no** agregar UI de guía por ahora. Si en QA molesta, se aborda en un change aparte (ej. filtrar a categorías del sistema cuando el toggle está activo).

## Verificado sin cambios

Deuda, cuenta corriente, reintegro heredado (0/100), proyección, listado de movimientos (`−$total` + `Tu parte: $0`), y "en qué se fue" (no aparece en el del pagador, completo en el del otro). El único trabajo es destrabar + el toggle.
