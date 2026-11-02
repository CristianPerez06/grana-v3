## MODIFIED Requirements

### Requirement: El algoritmo de sugerencia de fechas usa el promedio de períodos previos

El sistema SHALL exponer una función pura `suggestNextPeriodDates(accountId)` que devuelve `{ suggestedEndDate, suggestedDueDate }`. La lógica SHALL ser:

1. Tomar los últimos 3 períodos de la cuenta ordenados por `end_date DESC` (o 2 si solo hay 2, o 1 si solo hay 1).
2. Promediar la duración del ciclo: para cada par consecutivo, calcular `end_date(i) − end_date(i-1)`, y promediar.
3. Promediar la separación: para cada período, calcular `due_date − end_date`, y promediar.
4. Aplicar duración promedio al `end_date` del último período conocido → `suggestedEndDate`.
5. Aplicar separación promedio → `suggestedDueDate = suggestedEndDate + separación promedio`.
6. Si no hay períodos previos (caso del primer pago), usar fallback: `hoy + 30 días` y `hoy + 45 días`.
7. **Un vencimiento por mes calendario:** si `suggestedDueDate` no cae en un mes posterior al del `due_date` del último período conocido, SHALL pasar al día 1 del mes siguiente a ese `due_date`. Un banco emite un resumen por mes, así que una tarjeta no puede tener dos vencimientos en el mismo mes.

La regla del paso 7 SHALL aplicarse solo a fechas proyectadas. Un `due_date` que el usuario carga desde un resumen real se guarda tal cual.

#### Scenario: Sugerencia con dos períodos previos

- **WHEN** existen períodos previos con `end_date` `2026-04-15` (`due_date='2026-04-30'`) y `2026-05-15` (`due_date='2026-05-30'`)
- **THEN** `suggestNextPeriodDates` devuelve `suggestedEndDate='2026-06-14'` y `suggestedDueDate='2026-06-29'` (duración 30 días, separación 15 días)

#### Scenario: Sugerencia sin historial usa fallback

- **WHEN** la cuenta no tiene ningún `card_periods` previo y `today='2026-05-01'`
- **THEN** la función devuelve `suggestedEndDate='2026-05-31'` y `suggestedDueDate='2026-06-15'` (hoy+30 / hoy+45)

#### Scenario: El vencimiento proyectado no repite el mes del anterior

- **WHEN** existen períodos previos con `end_date` `2026-09-22` (`due_date='2026-10-03'`) y `2026-10-21` (`due_date='2026-11-01'`), y la proyección da cierre `2026-11-19` y vencimiento `2026-11-30`
- **THEN** `suggestNextPeriodDates` devuelve `suggestedEndDate='2026-11-19'` y `suggestedDueDate='2026-12-01'`
- **AND** «Compromisos de noviembre» cuenta un solo resumen de esa tarjeta

#### Scenario: Los estimados ya guardados se corrigen

- **WHEN** un período `is_estimated = true` y sin pago tiene `due_date` en el mismo mes que el `due_date` del período anterior de su tarjeta
- **THEN** la migración `0076` le asigna como `due_date` el día 1 del mes siguiente al vencimiento anterior
- **AND** no toca `start_date`, `end_date`, los períodos confirmados ni los pagados
