## ADDED Requirements

### Requirement: El aviso de gastos compartidos recurrentes por confirmar cuenta sólo lo que ya llegó

El módulo Compartido SHALL avisar cuántos gastos compartidos recurrentes hay por confirmar, y ese
conteo SHALL incluir únicamente las ocurrencias compartidas sin resolver **cuya fecha ya llegó**
—vencidas o de hoy—, evaluada contra la fecha financiera del usuario (`hoy` inyectado, nunca el reloj
del servidor). Una ocurrencia compartida sin resolver con fecha futura —por ejemplo, una que el
usuario desvinculó antes de su vencimiento— NO SHALL contar: el aviso pide al usuario que confirme
algo que ya tendría que haber pasado, y un vencimiento que todavía no llegó no es eso. Esa ocurrencia
sigue a la vista y resoluble en el bloque de vencimientos por revisar.

Sin ocurrencias que cuenten, el aviso NO SHALL mostrarse.

#### Scenario: Una compartida con fecha futura no cuenta para el aviso

- **WHEN** hoy es `2026-10-07` y la única ocurrencia compartida sin resolver vence el `2026-11-23`
- **THEN** el módulo Compartido no muestra el aviso de gastos compartidos por confirmar

#### Scenario: Una compartida vencida cuenta para el aviso

- **WHEN** hoy es `2026-10-07` y hay una ocurrencia compartida sin resolver del `2026-09-30` y otra del `2026-11-23`
- **THEN** el aviso dice que hay un gasto compartido recurrente por confirmar
