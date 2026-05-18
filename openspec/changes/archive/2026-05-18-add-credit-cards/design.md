## Context

`accounts` y `transactions` ya están archivados en v3 con scope acotado: cuentas `cash`/`bank` y transacciones `income`/`expense`/`transfer`/`adjustment`. Este change agrega el tipo de cuenta `credit` (tarjeta) — el diferencial de Grana — junto con todo lo que las tarjetas argentinas necesitan: ciclos con cuatro fechas variables, cuotas sin interés, asignación de consumos a períodos, alertas por vencimiento, y pago de resumen como operación atómica reversible.

La realidad del mercado AR condiciona el modelo:

- Las fechas de cierre y vencimiento **no son fijas mes a mes**. El usuario las lee del resumen del banco, no las calcula desde un día numérico.
- La compra en cuotas sin interés es el modo de uso dominante, no un edge case.
- El usuario "vive en dos resúmenes": el que está cerrado esperando pago y el actual donde caen los consumos nuevos.
- La bimoneda es asimétrica: la tarjeta tiene un único límite en ARS pero acepta consumos en USD que se liquidan al TC del día.

v2 ya resolvió este modelo con varios años de iteración (`D:/src/grana-v2/docs/specs/cuentas/SPEC-v2.md` y los `IMPLEMENTACION-*.md`). Este change lo porta a v3 incorporando las decisiones cerradas en la sesión de exploración:

- Disolver la tabla `credit_card_configs` separada → mover sus campos a `accounts`.
- Estado del período derivado puro (sin columna `status` en DB).
- Rolling automático de períodos para garantizar que siempre haya ≥1 abierto por delante.
- Asignación tx → período persistida como FK explícita (`card_period_id`).
- Pago de resumen reversible (v2 lo dejaba bloqueado).
- Mora visible desde V1.
- Onboarding novato auto-crea "Mi plata" + 1 tarjeta default con una sola fecha cargada.

## Goals / Non-Goals

**Goals:**

- Modelar tarjetas de crédito como ciudadano de primera clase del motor contable, con sus invariantes contables enforced en el schema.
- Garantizar que las tarjetas **no descuentan** `disponible` del usuario hasta que se paga el resumen.
- Soportar cuotas N>1 con distribución determinística del residuo (sin pérdida de centavos).
- Soportar bimoneda con un único límite ARS (consumos USD imputan al TC del día).
- Mantener la **misma experiencia funcional** del módulo para usuarios novato y experto — es el diferencial, no se recorta.
- Reducir fricción en el onboarding novato a una única fecha mientras se preserva el rigor contable.
- Habilitar pago de resumen como **operación atómica reversible** (5 efectos en una transacción DB, undo limpio).

**Non-Goals:**

- **Intereses** (punitorios por mora, financieros por pago mínimo). Decisión registrada: queda como upgrade futuro.
- **Pago mínimo / parcial** del resumen. V1 asume pago total; el monto editable es para redondeos.
- **Pago bimoneda** del resumen. V1 paga solo ARS; consumos USD se muestran como aclaración informativa.
- **Reabrir período pagado** para corregir un consumo olvidado. V1 bloquea backdating en período `paid`.
- **Cierre manual anticipado** de un período antes de su `end_date`.
- **Importación automática** de fechas/consumos desde resumen del banco (OCR, API).
- **Migración de datos legacy** de v2. Este change es greenfield en v3 — no se transfiere data.
- **Cambio de modo de usuario** post-onboarding (novato ↔ experto). Vive en `auth`, no acá.

## Decisions

### D1 — Disolver `credit_card_configs`; columnas en `accounts`

**Alternativas consideradas:**

- (A) Mantener tabla `credit_card_configs(account_id PK, credit_limit, network_id, other_network_name)` como en v2.
- (B) Mover esos campos a columnas en `accounts` (nullable, solo aplican cuando `type='credit'`). **Elegida.**

**Rationale.** La tabla v2 sólo tiene los campos exclusivos de tarjeta, ningún campo crece "1:N", no hay otras consultas que naturalmente queden mejor con un join. El patrón `institution_id` ya existe en `accounts` (solo aplicable a `bank`), entonces la convención del repo ya es "columnas nullable condicionales al `type`". Disolver elimina un join obligatorio en toda query de tarjeta y baja la complejidad mental. La integridad se preserva con constraints `CHECK` por tipo (`chk_credit_*`, `chk_cash_no_credit_limit`).

**Trade-off.** Si en el futuro `credit_*` crece (ej.: tabla aparte para configuración compleja de intereses), habrá que volver a tabla 1:1. Riesgo bajo: las features del backlog no requieren tabla aparte; el campo más complejo posible (intereses) seguramente se modela en tabla `card_interest_charges` separada igual.

### D2 — Estado del período derivado (sin columna `status`)

**Alternativas consideradas:**

- (A) Enum `status` en `card_periods` con valores `open|closed|paid` y transición vía cron/trigger/lazy update (como v2).
- (B) Estado derivado puro de `(end_date, due_date, today, exists period_payment)`. **Elegida.**

**Rationale.** v2 mantiene el enum pero en la práctica nunca actualiza `closed` (no hay auto-cierre); el detalle siempre recalcula la "variante" en cada lectura. El enum existe pero miente. Coherente con la filosofía del resto del repo, donde el balance de cuenta también se deriva y nunca se persiste. Una sola fuente de verdad (las fechas + la existencia del pago).

**Trade-off.** Si en el futuro hay que "cerrar manualmente antes de tiempo" o "marcar paid sin pago real", no hay palanca. Pero esos casos no están en scope. Se documenta como reversible: agregar la columna después es una migración trivial.

### D3 — FK explícita `transactions.card_period_id`

**Alternativas consideradas:**

- (A) FK explícita persistida al insertar la transacción. **Elegida.**
- (B) Derivar el período por `WHERE date BETWEEN period.start AND period.end` en cada lectura.

**Rationale.** Las queries "movimientos del período X" son muy frecuentes (detalle de tarjeta, historial). FK explícita las hace triviales. Además, permite tener restricciones a nivel DB ("una tx en tarjeta debe tener `card_period_id NOT NULL`"). El costo es que al editar las fechas de un período hay que **reubicar** (UPDATE de FKs) — pero ese flujo ya existe en v2 y está controlado por validaciones (no se reubica a períodos inexistentes, se rechaza el cambio).

### D4 — Rolling automático lazy de períodos

**Alternativas consideradas:**

- (A) **Lazy on-demand**: cuando una operación necesita un período cubriendo una fecha futura y no existe, se genera al vuelo con `is_estimated=true`. **Elegida.**
- (B) **Proactivo periódico**: cron diario que mantiene siempre 3-4 períodos por delante.
- (C) **Manual**: el usuario carga las fechas cada vez. Rechazo del usuario porque obliga a "saber las fechas" cuando todavía no las publicó el banco.

**Rationale.** El lazy on-demand cubre el caso real (consumo entre cierre y siguiente cierre) sin acumular períodos fantasma que el usuario nunca usa. La sugerencia se calcula con los promedios más recientes (más precisa que un cron que corrió hace días). El `is_estimated=true` deja huella visual para que el usuario corrija si la app erró.

**Trade-off.** Si el primer consumo de un período cae muy cerca del cierre y el algoritmo de promedios todavía no tiene datos suficientes, la estimación puede estar lejos. Mitigación: en la primera estimación (sin historial), usamos fallback neutro `hoy+30` / `hoy+45`; el usuario corrige fácil desde el detalle.

### D5 — Asignación de cuotas N>1 con `date` virtual + `card_period_id`

**Alternativas consideradas:**

- (A) Cada cuota hija tiene su propio `date` (virtual: fecha del consumo + N meses) **y** su `card_period_id`. **Elegida.**
- (B) `date` único en la madre, `due_date` distinto por cuota; asignación a período se hace por `due_date`.
- (C) Cuotas como filas simples sin estructura madre/hija.

**Rationale.** (A) es coherente con la decisión D3 (asignación por `date` persistida como FK). El `date` de la cuota representa "cuándo se imputa al resumen" (settlement date), no "cuándo se hizo la compra real" — esa última vive en la madre. (C) se descartó porque imposibilita "ver la compra completa" y el delete en cascada.

**Trade-off.** El `date` de la cuota no refleja literalmente "la fecha del hecho económico" (eso vive solo en la madre). Esto puede confundir si alguien lee `transactions.date` de una hija esperando "cuándo se compró". Mitigación: el componente UI siempre muestra "Compra del DD-mm" derivado de la madre cuando la fila es una hija; los reportes de fechas se hacen sobre madres + simples (no hijas).

### D6 — Pago de resumen atómico reversible

**Alternativas consideradas:**

- (A) Atómico al pagar (5 efectos en una transacción DB) **y reversible** (deshacer revierte cuotas + borra `period_payment` + borra el expense). **Elegida.**
- (B) Atómico pero no reversible (v2).

**Rationale.** El usuario puede equivocarse al elegir la cuenta de pago o el monto. Bloquear la reversión obliga a workarounds (ajuste manual, contactar soporte). Habilitar reversión atómica es honesto y simple — mismo principio del pago, en sentido inverso. El siguiente período creado durante el pago **no** se borra automáticamente al revertir (vive como `card_period` independiente que el usuario puede borrar si quiere y si está open + vacío).

**Trade-off.** Reversión expone una palanca peligrosa si la UI no la protege bien. Mitigación: confirmación explícita en UI antes de revertir, e indicaciones claras de qué pasa con cada parte (las cuotas vuelven a pending, etc.).

### D7 — Onboarding novato con una sola fecha

**Alternativas consideradas:**

- (A) Pedir las 4 fechas en el onboarding (como hace el experto). Fricción alta.
- (B) Crear con fechas defaults absolutas (ej.: cierre día 5, vence día 20) como v2. Confunde al usuario porque las fechas no representan nada real hasta que se confirman.
- (C) Pedir 1 sola fecha (cuándo cierra el resumen actual) y estimar el resto. **Elegida.**

**Rationale.** El usuario novato seguramente sabe (o ve fácil en home banking) cuándo es su próximo cierre. Esa única fecha es suficiente para:

- Crear el período actual con `end_date = fecha cargada`, `due_date = fecha + 15 días` (gracia típica en AR).
- Crear el próximo período con `end_date = fecha + 30 días`, `due_date = fecha + 45 días`.
- Calcular `start_date` de cada uno (técnico, no se muestra).

Las 3 fechas estimadas se marcan `is_estimated=true` y la UI las indica con un iconito 📅. Se confirman en el primer pago de resumen (flujo natural — el usuario tiene el resumen real a la vista) o desde el detalle.

**Trade-off.** Si el banco usa un ciclo no típico (ej.: cierre quincenal), los defaults van a errar más. Pero el flujo de corrección está siempre disponible. Si la métrica muestra que muchas tarjetas pasan al primer pago con fechas todavía estimadas, hay que iterar el copy del onboarding.

### D8 — Catálogo de redes en tabla `card_networks` separada

**Alternativas consideradas:**

- (A) Hardcodear las redes como enum en código.
- (B) Tabla `card_networks` seed (Visa, Mastercard, Amex, Cabal, Naranja, Naranja X, Mercado Pago) con metadata (color, ícono, orden). **Elegida.**

**Rationale.** La metadata visual (color de marca, slug del ícono) cambia con menos fricción si es data, no código. Permite agregar redes nuevas (ej.: "Modo" si crece) sin redeploy. El XOR con `other_network_name` cubre las que no están en el catálogo. Constraint `chk_network_xor` enforced en DB.

### D9 — Mora visible desde V1

**Alternativas consideradas:**

- (A) Diferenciación visual desde V1 (card roja, banner "Vencido hace N días"). **Elegida.**
- (B) Mismo tratamiento que "cerrado esperando pago" — v2.

**Rationale.** Es señal, no penalidad: la app no calcula intereses ni cobra nada, solo le avisa al usuario que pasó la fecha. Es coherente con la propuesta de valor "claridad sobre dónde está tu plata". Sin esto, un usuario podría tener una tarjeta vencida y no enterarse hasta que el banco le cobra.

### D10 — Archivar tarjeta bloqueado con deuda pendiente

**Alternativas consideradas:**

- (A) Permitir archivar siempre (consistente con `cash`/`bank` actuales).
- (B) Bloquear archivar si hay período no-paid con transacciones imputadas (regla R-tarjeta de v2). **Elegida.**

**Rationale.** Una tarjeta archivada "desaparece" del listado activo. Si tiene deuda real, archivarla equivale a esconderla — el usuario pierde el aviso de vencimiento y el monto a pagar. La integridad de Grana (saber dónde está cada peso) se rompe. Mejor obligar a pagar el resumen abierto antes de archivar.

**Trade-off.** Si el usuario cerró la cuenta del banco y no piensa pagar más esa tarjeta, la regla lo obliga a hacer maniobras (ajuste manual, etc.) para liberar. Mitigación: documentar la salida; eventualmente "cerrar tarjeta sin pago" sería un flujo aparte (no V1).

## Risks / Trade-offs

- **[Estado derivado sin columna]** → Sin enum en DB, una query mal escrita puede mostrar un período pagado como "open". Mitigación: helper único `derivePeriodStatus(period, today, hasPayment)` consumido por todas las queries; tests cubren los 4 estados con borde en `end_date` / `due_date`.
- **[Rolling lazy on-demand]** → Si dos requests concurrentes intentan generar el "siguiente" período al mismo tiempo, podría haber race. Mitigación: UNIQUE `(account_id, start_date)` rechaza el duplicado a nivel DB y el código lo trata como "ya existía, leer y seguir".
- **[Reubicación de tx al editar fechas]** → Editar `end_date` de un período `open` puede reubicar muchas tx a otros períodos (o ninguno si el nuevo rango cae en otro período inexistente). v2 mostraba preview de impacto; V1 de v3 hace lo mismo. Si el usuario rechaza, no se guarda. Si reubicar exige un período inexistente, se rechaza el cambio con copy explicativo (R-CRED-7 hereda R7 de v2).
- **[`fx_rate_to_ars` inconsistente]** → Si una tx no-ARS se inserta sin `fx_rate_to_ars`, el cálculo de "%  límite disponible" rompe en silencio. Mitigación: constraint `CHECK` lo enforza ("if `account.type='credit'` and `currency != 'ARS'` then `fx_rate_to_ars IS NOT NULL`"), test cubre el caso.
- **[Reversión de pago + período siguiente huérfano]** → Al revertir el pago, no borramos el período creado en ese pago (puede tener consumos nuevos imputados). Si el usuario quiere borrarlo, debe hacerlo a mano y solo si está `open` + vacío. Mitigación: UI muestra ese período como "creado el DD-mm al pagar el resumen anterior" para que sea claro su origen.
- **[Tarjeta default novato sin banco]** → `chk_credit_no_institution` no aplica al novato (su `institution_id` es `NULL`). Eso es una excepción de la regla "todo `credit` tiene `institution_id`". Resolución: relajar el constraint a `WHERE name != 'Mi tarjeta'` no es semántico — preferimos que `institution_id` sea `NULL` permitido para `credit` igual que para `cash`, y manejar la validación de "experto debe elegir institución" en el form (UI-only). Documentado en spec `accounts`.
- **[Cambio de network post-creación bloqueado]** → Si el usuario crea con red equivocada, no puede corregir vía edición (es inmutable). Mitigación: bien comunicado en el form, el usuario puede borrar y recrear si la tarjeta no tiene tx jamás (política general de `accounts`).
- **[Cuotas N>1 con redondeo de centavos]** → Distribución residuo-a-primera evita pérdida, pero deja la cuota 1 visiblemente "más grande". Estandarizado, testeado en v2.

## Migration Plan

v3 es greenfield para tarjetas — no hay data de v2 que migrar. Pasos del rollout:

1. **Migración schema**:
   - ALTER `accounts`: extender enum `type`, agregar `credit_limit`, `network_id`, `other_network_name` + constraints `CHECK`.
   - CREATE tabla `card_networks` + seed con las 7 redes iniciales.
   - CREATE tabla `card_periods` + indices (`account_id, start_date`, UNIQUE).
   - CREATE tabla `period_payments` + UNIQUE(period_id).
   - ALTER `transactions`: agregar `status`, `due_date`, `is_parent`, `parent_id`, `installment_n`, `installments_total`, `card_period_id`, `fx_rate_to_ars` + constraints `CHECK`.
   - Regenerar `packages/supabase/src/types.ts` con `supabase gen types`.

2. **Backend**: implementar actions y queries enumeradas en proposal (`createCreditCard`, `registerCardPurchase`, `registerInstallments`, `payCardPeriod`, `reverseCardPayment`, `updatePeriodDates`, `deactivateCreditCardAccount`).

3. **Frontend**: portar componentes desde `D:/src/grana-v2/src/modules/credit-cards/` con refactor V3 (CardHero, PeriodCard, PeriodsListScreen, EditDatesSheet, etc.).

4. **Onboarding novato**: agregar paso "¿cuándo cierra tu actual resumen?" + auto-creación de entidades default.

**Rollback**: como v3 es greenfield, el rollback es revertir las migraciones de schema y los archivos de código. No hay data productiva por preservar.

## Open Questions

- **¿`installment_n` y `installments_total` se preservan en la madre o solo en las hijas?** Propuesta: solo en hijas. La madre tiene `installments_total` opcional para mostrar "Compra en 6 cuotas" en su detalle, pero `installment_n` siempre NULL en madre. Decidir al implementar — bajo impacto.
- **¿La sugerencia de fechas (`suggestNextPeriodDates`) usa los últimos 2 períodos o los últimos 3?** v2 dice "promedio de últimos 2-3". Definir constante en implementación; default propuesto: últimos 3 si existen, último 2 si no, único si solo hay 1, fallback `hoy+30`/`hoy+45` si no hay ninguno.
- **¿La pantalla de "edición de fechas" entra en V1 o es post-V1?** v2 la había marcado como "completa" para spec pero el sprint inicial entregaba versión limitada (solo si el período no tenía transacciones). Propuesta: V1 entrega versión limitada (igual que v2 sprint); flujo completo con reubicación queda para upgrade. **Cerrar antes de tasks.**
- **¿El form de alta experto pide categoría default para la tarjeta?** No — la categoría se elige por transacción. Pero ¿memorizar la última usada como sugerencia? Decisión menor de UI, no afecta modelo.
