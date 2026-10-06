## Context

Ver `proposal.md` (Why). Estado actual del código:

- Los períodos solo se crean en tres lugares: el alta (`createCreditCard`, P1 real + P2 estimado), el pago (`payCardPeriod`, que confirma P(n+1) y proyecta P(n+2)) y la imputación de un consumo (`getOrCreatePeriodForDate` en `@grana/transactions-mutations`). Esta última crea **un solo** período a continuación del último, aunque no llegue a la fecha del consumo: un consumo del 06/10 en una tarjeta cuyo último cierre fue el 25/07 cae en `26/07 → 24/08`.
- `getCreditCards` elige el `activePeriod` con prioridad vencido-con-deuda → cerrado-con-deuda → abierto que contiene hoy → `unpaidPeriods.at(-1)`. En una tarjeta parada no hay ninguno que contenga hoy, así que gana el último fallback: un período vencido sin consumos. `derivePeriodVariant` le da `vencido` y `pillTone` lo pinta "A pagar".
- `resolveEditCycle` toma como "resumen actual" el que contiene hoy y, si no hay, el primer impago. Por eso en la tarjeta parada el formulario edita el de junio.
- `updatePeriodDates` rechaza `new_end_date >= next.end_date` sin mirar si el próximo es una estimación vacía. El formulario guarda siempre primero el actual y después el próximo.
- RLS ya permite `insert`/`update`/`delete` de `card_periods` propios (migración 0010), y existe `UNIQUE (account_id, start_date)`. No hace falta migración.

## Goals / Non-Goals

**Goals:**
- Una sola regla de "completar hacia adelante", usada por consumos, lecturas y edición.
- Que "sin consumos" se derive igual en todas las superficies, desde `@grana/money-logic` / `@grana/cards`, sin que ninguna app lo recalcule.
- No alterar el comportamiento de tarjetas que se usan: si un período ya cubre hoy, ninguna lectura escribe nada.

**Non-Goals:**
- Mejorar la estimación de fechas (anclar al día del mes).
- Tocar dashboard/compromisos.

## Decisions

### 1. Completar el calendario al leer, escribiendo filas reales

Las lecturas `getCreditCards` (solo tarjetas activas) y `getCreditCardDetail` (si la tarjeta está activa) llaman, antes de leer períodos, a una función compartida que crea los períodos estimados que faltan hasta hoy.

Por qué filas reales y no un período "virtual" calculado en memoria: las pantallas del resumen se navegan por `periodId` (`/cards/[id]/periods/[periodId]`), los consumos necesitan una fila donde imputarse, y el formulario de edición escribe sobre un período existente. Un período virtual obligaría a cada una de esas rutas a manejar un caso sin id, y habría dos verdades sobre el calendario. El invariante `I-CRED-12` ya dice "lazy": abrir la tarjeta pasa a ser una de las operaciones que lo disparan.

Cuándo escribe: solo cuando el último período termina antes de hoy. En una tarjeta en uso no hay escritura, así que el costo en la lectura es nulo salvo la primera vez.

### 2. Un planificador puro y un único ejecutor

- `@grana/money-logic`: `planPeriodRollForward(periods, throughDate, today)` → lista de `{ start_date, end_date, due_date }` a crear, contiguos, cada uno sugerido con `suggestNextPeriodDates` sobre los períodos existentes **más los ya planificados**, hasta que el último cubra `throughDate`. Tope de seguridad de 120 iteraciones (diez años de ciclos mensuales). Puro y testeable.
- `@grana/transactions-mutations` (`internal/card-periods.ts`): `rollCardPeriodsForward(supabase, accountId, throughDate, today)` inserta el plan. Ante un `23505` (otra pestaña ganó la UNIQUE) relee y sigue. `getOrCreatePeriodForDate` rama 4 pasa a usarlo y devuelve el período que cubre la fecha, en lugar de insertar uno solo. Se exporta para que `@grana/cards` lo use en las lecturas: la dependencia `@grana/cards → @grana/transactions-mutations` ya existe.

### 3. "Sin consumos" como variante derivada

`derivePeriodVariant` suma la variante `sin_consumos` para `closed`/`overdue` con `txCount === 0`. No cambia `derivePeriodStatus`: el árbol de estado de la spec sigue igual, lo nuevo es cómo se presenta.

- Todo lo que hoy pregunta `variant === 'vencido' || 'cerrado_esperando_pago'` (CTA de pago en web y mobile, guard de la pantalla de pago, `cardToPay`, `pillTone`, `cardTone`) deja afuera el vacío sin tocarse, porque el vacío ya no tiene esas variantes.
- `CardTone` suma `'empty'`. `cardTone`/`pillTone` devuelven `'empty'` cuando no hay a pagar y el período vigente tiene `tx_count === 0` (también para `tarjeta_nueva`), por delante de las alertas `amber`/`red`. `TONE_RANK` lo ubica después de `ok` (`due < soon < ok < empty`), así que un grupo mezclado sigue siendo "Al día". `applyFilter('due-soon')` pasa a `tone === 'due' || tone === 'soon'`.
- Etiqueta: `cards.pill.empty` = "Sin consumos" / "No charges". Colores neutros con tokens existentes (`bg-border-soft text-text-muted`, dot `bg-text-soft` o el equivalente en mobile), verificando que existan en `@grana/ui-tokens`.
- El listado de resúmenes y el detalle del resumen mapean la nueva variante a "Sin consumos" donde hoy mapean variantes a etiquetas.

### 4. Absorción en `updatePeriodDates` y orden de guardado compartido

- `updatePeriodDates` lee todos los períodos posteriores al editado, no solo el inmediato. Si `new_end_date >= next.end_date`, toma los que quedarían enteramente cubiertos (`end_date ≤ new_end_date`): si alguno tiene transacciones, pago o `is_estimated=false`, rechaza igual que hoy. Si no, los borra y aplica la cascada existente sobre el primero que sigue. Si no queda ninguno, inserta uno estimado con `suggestNextPeriodDates`. La decisión es una función pura en `@grana/money-logic` (`planPeriodEndEdit`), con el mismo estilo que `planRunningCycleConfirmation`.
- El orden de guardado actual/próximo lo decide una función pura en `@grana/cards` (`orderCycleDateWrites`), que usan tanto `EditCardForm` web como el nativo, para que el orden no se reescriba en cada app.

## Risks / Trade-offs

- [Una lectura que escribe] → Es idempotente, está acotada por la UNIQUE y solo escribe cuando el calendario está atrasado. Un prefetch de Next que la dispare no produce nada distinto que abrir la página.
- [Una tarjeta parada por años crea muchos resúmenes vacíos en el historial] → Es lo correcto contablemente: si después aparece un consumo de agosto, tiene su resumen. Tope de 120 por si hay datos corruptos.
- [Las estimaciones encadenadas derivan unos días respecto del banco] → Ya pasa hoy con un solo estimado. El usuario lo corrige editando las fechas, que es justamente lo que esta change destraba.
- [Borrar períodos en la absorción] → Solo estimados, sin transacciones ni pago. No hay otras FKs que los referencien (`transactions.card_period_id` RESTRICT y `period_payments` son las únicas, y ambas están vacías por condición).
