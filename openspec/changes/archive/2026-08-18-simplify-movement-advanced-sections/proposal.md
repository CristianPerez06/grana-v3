# Proposal: simplify-movement-advanced-sections

## Why

El alta de movimientos ya converge en las superficies mobile (web-vista-mobile y app nativa): tabs Gasto/Ingreso/Otros, hero de monto, calculadora, chips de clasificación frecuente y campos secundarios en una tarjeta única. Lo que quedó sin pulir es el **despliegue de las tres secciones avanzadas de Capa 1** —Reintegro, Compartido (split) y Repetir (recurrencia)—: los chips de activación son paritarios, pero **los parámetros que se revelan al activarlas divergen entre superficies y cargan más superficie de la necesaria**.

Auditoría (14-ago-2026), sobre `apps/web/lib/transactions/components/movement-form.tsx` (rama mobile) y `apps/mobile/components/transactions/MovementForm.tsx`:

- **Reintegro.** Al activarlo, el card revela de una todos sus controles: monto estimado, la fila "% del gasto / Tope", la cuenta de acreditación y el "ya me lo acreditaron". Es la sección más cargada de las tres (el usuario la señaló como la que "hay que simplificar"). Además los controles divergen: en web el "ya me lo acreditaron" es un `<input type="checkbox">` crudo, el destino a cuenta/resumen son `<input type="radio">` crudos y la cuenta un `<select>`; en nativo son `Switch`, `RadioRow` y un picker de sheet. La regla del repo dice que superficies equivalentes usan el primitivo equivalente: los controles crudos de web-mobile son los outliers.
- **Compartido.** Divergencia **funcional**, no solo visual. Web ofrece un **input de porcentaje libre (1–99)** más un `Switch` "es 100% del otro" (borde 0/100); nativo ofrece un `Segmented` de **tres presets fijos** (100/50/0) y **no permite un 70/30**, en contra de su propio requirement (`transactions` §alta-nativa: "cualquier reparto") y del `shared` §split (editor `1..99`). Encima cada superficie usa claves i18n distintas (`shared.split.*` vs `transactions.form.split_*`).
- **Repetir.** Divergencia menor: el intervalo custom elige la unidad con un `<select>` en web y con chips en nativo; el resto (chips de frecuencia, count, fecha fin) ya está alineado.

El hook `useMovementForm` ya expone un modelo de datos único (`splitFirstPct: number` 0–100, `reimbursementReceivedNow: boolean`, `intervalUnit`), así que estas divergencias son **puramente de presentación**: se resuelven sin tocar reglas contables ni el contrato del hook.

## What Changes

Bajo la lente de "menos taps / superficie mínima" y paridad mobile-web ↔ nativo:

- **Reintegro — bloque compacto de dos filas (diseño cerrado con el PO).** El card revelado deja de volcar 5 campos apilados (~330 px) y pasa a **dos filas compactas (~79 px)** sin labels sobre los campos (ref. visual en `docs/design/movement-form/reintegro/`). **Fila 1:** monto del reintegro + la regla **`% + tope` visible inline** (no detrás de un disparador); el % deriva el monto de forma bidireccional (`applyReimbursementPercent`) y el tope lo acota, resaltándose cuando aplica. **Fila 2:** destino **`Resumen | Cuenta`** (Segmented, solo con crédito; el default lo fija el hook sin cambio de comportamiento) + estado **"Acreditado"** (checkbox compacto). Se **preserva la funcionalidad activa**: tocar "Cuenta" elige la cuenta de la **misma entidad del medio de pago** sin abrir nada (`pickReimbursementAccount`), tocar el nombre abre el selector (misma entidad primero), y "Acreditado" off deja el reintegro pendiente. Web-mobile reemplaza sus controles crudos (`checkbox`/`radio`/`select`) por los equivalentes diseñados, con la misma estructura que el nativo.
- **Compartido — atajos de un tap + barra de reparto (diseño cerrado con el PO).** Ambas superficies ofrecen los atajos **Mitad · 70/30 · 75/25 · Todo suyo · Otro** (los % son *tu parte*) más una **barra proporcional Vos / [otro integrante]** (nombre traído del Hogar; puede mostrar % o montos). El atajo **"Todo suyo" fija 0/100**, así que el `Switch` suelto "es 100% del otro" **desaparece**; **no** hay atajo "todo mío" (un gasto 100% propio no se marca compartido). **"Otro"** transforma la fila de chips en dos campos % (el tuyo editable con teclado del sistema; el del otro calculado, gris, no editable). Nativo **gana** el reparto arbitrario que hoy le falta. Copy unificado en `shared.split.*`. Ref. visual: `docs/design/movement-form/compartir/`.
- **Repetir — unidad de intervalo como chips en ambas.** El `<select>` de unidad de web-mobile pasa a chips, espejo del nativo. Sin otros cambios.

Nada de esto altera un campo, un tipo de movimiento, una regla contable ni el contrato del hook. La paridad se evalúa por **rol y estructura**, no por píxeles. La superficie **desktop** de web no se toca (sigue gateada por breakpoint).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`:
  1. **Nuevo requirement** "El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile" — regla transversal que gobierna, por rol y estructura, cómo se revelan los parámetros de Reintegro, Compartido y Repetir en web-mobile y en nativo (reintegro como bloque compacto de dos filas con %/tope visible + destino `Resumen | Cuenta` + check "Acreditado"; compartir con atajos + barra de reparto + modo "Otro"; recurrente como bloque compacto de dos filas sin Anual).
  2. "El formulario ofrece las funcionalidades avanzadas según el contexto y las activa en el lugar" — se refina para exigir superficie mínima al revelar, sea por densidad (reintegro) o por disclosure (editor de % libre del split).
  3. "La app nativa expone la pantalla de alta de movimiento `/transactions/new`" — se alinea la descripción de los controles: el split pasa a atajos (`Mitad · 70/30 · 75/25 · Todo suyo · Otro`) + barra de reparto, el reintegro al bloque compacto de dos filas, y el recurrente al bloque de dos filas sin Anual.

- `shared`:
  1. "El usuario puede marcar un gasto como compartido con un split por porcentaje" — los atajos pasan a **`Mitad · 70/30 · 75/25 · Todo suyo · Otro`** con una **barra de reparto Vos / [otro integrante]**; el caso 0/100 es el atajo **"Todo suyo"** (reemplaza el toggle dedicado) y NO hay atajo "todo mío"; el editor de % libre se revela con "Otro". La semántica (`{pagador: 0, otro: 100}`, porcentajes 0–100 que suman 100) no cambia; el editor del **split por defecto del hogar** en `/shared/settings` sigue acotado a `1..99` y **no** se toca.

## Impact

- **Sin migración, sin cambios de schema, sin cambios en el hook compartido.** El estado (`splitFirstPct`, `reimbursementReceivedNow`, `reimbursementPercent`/`Cap`, `intervalUnit`) ya existe.
- `apps/web/lib/transactions/components/movement-form.tsx` (rama `isMobile`): reintegro (bloque compacto de 2 filas), compartido (atajos `Mitad · 70/30 · 75/25 · Todo suyo · Otro` + barra de reparto + modo "Otro" de dos campos, quita el `Switch` fully-other), repetir (bloque compacto de 2 filas, sin Anual). La rama desktop queda intacta.
- `apps/mobile/components/transactions/MovementForm.tsx`: mismos rediseños por rol (reintegro 2 filas; compartido atajos + barra + "Otro"; repetir 2 filas sin Anual). La sugerencia de misma entidad (`pickReimbursementAccount`) ya existe.
- `packages/i18n-messages`: familia unificada del split en `shared.split.*` (`half`/`all_other`/`you`/`other_short`/`owes`/`write_your_share`) + copy del reintegro (`Resumen`/`Cuenta`/`same_bank`/`cap_short`) y del recurrente (`repeat_*`, `units_short`).
- `apps/web/components/ui/date-picker.tsx`: prop aditiva `onClear`/`clearLabel` (footer "Sin fecha de fin" del recurrente).
- **UX**: el card de Reintegro pasa de ~330 px (5 campos apilados) a ~79 px (2 filas) sin perder funcionalidad; el split se resuelve de un tap en el caso común y conserva el reparto fino; ambas superficies quedan indistinguibles por rol. Ningún gasto simple atraviesa nada de esto (las secciones siguen arrancando desactivadas).
- **Revisión**: el web-vista-mobile lo verifica el usuario en el navegador (viewport de celular); el nativo lo revisa el tech lead (sin device en esta sesión).
