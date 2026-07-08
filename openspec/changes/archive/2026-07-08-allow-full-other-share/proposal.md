## Why

Falta un caso real y común: **un gasto que pagás vos pero que es 100% del otro miembro** ("te lo pago yo y me lo devolvés"). Hoy no se puede cargar. Se modela naturalmente como un split `{vos: 0%, el otro: 100%}`, pero el **0% está bloqueado en tres capas**:

1. **UI** — `movement-form.tsx:1398` clampa el % del split a `1..99`.
2. **Validación** — `packages/validation/src/shared.ts:27` exige `percentage.min(1)`.
3. **Base** — `0023_shared.sql:64` `chk_split_percentage check (percentage between 1 and 100)`.

La regla `≥ 1` se puso para evitar splits degenerados, pero terminó prohibiendo un caso legítimo. El resto del sistema **ya soporta el 0/100 sin cambios** (verificado en código):

- **Motor de deuda** (`money-logic/shared.ts:121-133`): la fila del pagador (su propia parte) hace `continue`; la del otro (100%) genera la deuda por el total → *el otro te debe todo*. Correcto.
- **"En qué se fue" por categoría** (`dashboard/queries.ts:282-296`): cuenta la **parte propia** de cada uno (`amount_assigned`) e incluye los compartidos del otro vía RLS. Con 0/100: **no aparece en el tuyo** (tu parte $0), **aparece completo en el del otro**. Exactamente lo pedido: no contamina tus categorías, impacta solo las del otro.
- **Cuenta corriente, reintegro heredado, listado de movimientos** (`−$total` + `Tu parte: $0`, ya resuelto en el change `shared-recent-mi-consumo`): fluyen sin tocar nada.

Financieramente cierra: pagás $X (tu cuenta baja, salida real), tu *consumo* es $0, y el gap es la deuda a tu favor.

## What Changes

**Destrabar el 0/100 y exponerlo con un affordance claro.** El backend habilita ambas plataformas; la UI web la hacemos nosotros y la mobile queda como handoff del tech lead ([[mobile-is-tech-lead]]).

- **DB (migración 0047):** `chk_split_percentage` pasa de `between 1 and 100` a `between 0 and 100`. Afecta solo los splits por-gasto (el split por defecto del hogar se guarda como JSON, sin este check).
- **Validación:** `splitEntrySchema.percentage` pasa de `.min(1)` a `.min(0)`. La suma exacta = 100 y `min(2)` miembros siguen impidiendo splits degenerados (`{0,0}` no suma 100).
- **UI web — toggle dedicado (alta + edición):** dentro del editor de split, un switch **"Lo pagué yo, pero es 100% de {nombre}"** con subtexto **"Te queda debiendo el total"**. Al activarlo fija `{vos: 0, otro: 100}` y oculta el campo `%`; al desactivarlo vuelve el editor libre (`1..99`). Es aditivo: no toca el caso normal (mitad y mitad / repartos 1..99).
- **Mobile — handoff:** el tech lead agrega el mismo toggle en el form nativo; el contrato (validación + DB) ya lo habilita.

**Se mantiene:** el editor de split **por defecto del hogar** queda clampeado `1..99` (un default 0/100 no es un caso de uso; el 100%-del-otro es una decisión por-gasto).

**Recomendación de producto (documentada, sin UI extra):** para que el gasto caiga con su nombre en el desglose del otro, conviene categorizarlo con una **categoría del sistema** (ambos las comparten). Si se usa una categoría **privada** del pagador, el otro ve el monto pero no el nombre (la RLS de categorías le tapa las privadas ajenas). No es contaminación —al pagador nunca le aparece—, es una degradación menor del lado del otro.

## Capabilities

### Modified Capabilities
- `shared`: un gasto compartido SHALL poder asignar a un miembro el **0%** (y al otro el 100%), de modo que el pagador cubra un gasto que corresponde íntegramente al otro. La suma sigue siendo 100 y todos los miembros siguen listados. Se expone con un toggle dedicado en el formulario.

### Unchanged (verificado, sin delta)
- `spending-by-category`: ya cuenta la parte propia y excluye los compartidos sin parte propia (change `2026-06-18-spending-counts-shared-split`). El 0/100 encaja sin cambios.
