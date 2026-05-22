## MODIFIED Requirements

### Requirement: El detalle de tarjeta muestra el resumen actual, próximo, y acciones primarias

El sistema SHALL renderizar la pantalla de detalle de una tarjeta de crédito (`/cards/[id]`) con la siguiente estructura, de arriba hacia abajo:

1. **Breadcrumb** "← Tarjetas".
2. **Identidad**: nombre de la tarjeta, banco (si lo hay), y `Límite $X` formateado en ARS. El segmento "Límite $X" SHALL omitirse cuando `credit_limit` es `null`.
3. **Banner full-width rojo "Resumen vencido"** ÚNICAMENTE cuando el período activo tiene estado derivado `overdue`. NO existe banner ámbar de "se acerca": esa información ya la comunica el campo `vence DD/MM` de la columna `EN CURSO`.
4. **Termómetro "Cómo viene tu tarjeta"** con tres columnas siempre presentes — `EN CURSO`, `PRÓXIMO`, `SIGUIENTE`. Cada columna SHALL mostrar:
   - `cierra DD/MM` y `vence DD/MM` arriba.
   - Barra horizontal con `% usado = pendingARS_de_esa_columna / credit_limit` (solo si hay límite cargado). Color: ≤69% primario, 70%-89% ámbar, ≥90% rojo.
   - Monto ARS pendiente formateado.
   - Monto USD subordinado (`USD X,XX` chiquito) si la tarjeta tiene USD activo en `account_currencies`. Se muestra incluso cuando es `0,00`.
   - Texto `"sin cuotas"` debajo del monto cuando ARS de esa columna es `0`.

   La columna 1 (período activo) SHALL etiquetarse según el estado derivado del período activo: `EN CURSO` (`actual`, neutral), `POR PAGAR` (`closed`, ámbar), `VENCIDO` (`overdue`, rojo), `PAGADO` (`paid`, gris/verde). Las columnas 2 y 3 SHALL etiquetarse `PRÓXIMO` y `SIGUIENTE` siempre (estado típico: `futuro` o vacío).

   El termómetro NO se renderiza en el caso `tarjeta_nueva` (ver requirement de estado vacío); en su lugar se renderiza el estado vacío específico.

5. **Línea total de disponible** debajo del termómetro, con cuatro variantes mutuamente excluyentes:
   - Normal: `Disponible $X de $Y` donde `X = credit_limit − Σ(pendingARS de las 3 columnas)` y `Y = credit_limit`.
   - Sin compromisos (`X == Y`): `Disponible $Y de $Y`.
   - Excede el límite (`X < 0`): `Comprometido $|monto_total_comprometido| — $|X| por encima del límite` en color de alerta.
   - Sin límite cargado (`credit_limit` es `null`): `"Cargá el límite para ver cuánto te queda"` con link `[Cargar]` que navega al editor de la tarjeta.

   El cálculo es ARS-only: los montos USD subordinados NO entran (principio Bimoneda + `I-CRED-9`).

6. **CTAs por estado del período activo**:
   - `actual`, `pagado` (sin otro pendiente): `[Registrar consumo]` único.
   - `cerrado_esperando_pago`: `[Pagar resumen]` primario + `[Registrar consumo]` secundario.
   - `vencido`: `[Pagar ahora]` primario en color rojo + `[Registrar consumo]` secundario.
   - Tarjeta archivada **con pendientes**: `[Pagar resumen]` cuando aplica, sin `[Registrar consumo]`.
   - Tarjeta archivada **sin pendientes**: estado vacío "Tarjeta archivada · sin pendientes" con `[Reactivar]` como única acción. El sistema NO ofrece `[Eliminar definitivamente]` en este caso porque la action `deleteAccount` bloquea el borrado de toda cuenta con historial transaccional (regla de integridad contable preexistente en `accounts`).

   El sistema SHALL NOT renderizar un botón "Cuotas — Próximamente". La feature de cuotas, cuando exista, agregará su CTA mediante un nuevo requirement.

7. **Sección "Movimientos del resumen actual"**: lista completa sin paginación de las transacciones imputadas al período activo, ordenadas por `date DESC, created_at DESC, id DESC` (orden de display). El encabezado de la sección SHALL incluir un único link `"Ver todos los resúmenes →"` apuntando a `/cards/[id]/periods`. NO se muestran links duplicados con labels distintos.

8. **Footer admin** discreto al pie con links: `Detalles` (fecha de alta, fecha de archivado), `Editar`, y `Archivar` (si activa con movimientos) / `Eliminar` (si activa sin movimientos) / `Reactivar` (si inactiva).

#### Scenario: Detalle con período `actual` y límite cargado muestra termómetro normal

- **WHEN** el usuario abre el detalle de una tarjeta activa con período actual `open` (sin pago), `credit_limit=$200.000`, `pendingARS_actual=$156.000`, `pendingARS_próximo=$40.000` (cuotas), `pendingARS_siguiente=$25.000` (cuotas)
- **THEN** el termómetro muestra columna `EN CURSO` (neutral, 78%, $156.000), columna `PRÓXIMO` (20%, $40.000), columna `SIGUIENTE` (13%, $25.000)
- **AND** la línea total dice `Disponible $-21.000 de $200.000` formateado como `Comprometido $221.000 — $21.000 por encima del límite` en color de alerta
- **AND** el CTA primario es `[Registrar consumo]`

#### Scenario: Detalle con período `cerrado_esperando_pago` muestra etiqueta POR PAGAR y CTA Pagar resumen

- **WHEN** el período activo tiene `end_date < today ≤ due_date` sin pago
- **THEN** la columna 1 del termómetro se etiqueta `POR PAGAR` con color ámbar
- **AND** el CTA primario es `[Pagar resumen]` y el secundario `[Registrar consumo]`
- **AND** no se muestra banner full-width

#### Scenario: Detalle con período `vencido` muestra banner rojo, etiqueta VENCIDO y CTA Pagar ahora

- **WHEN** el período activo está `overdue` (`due_date < today` sin pago)
- **THEN** se renderiza un banner full-width rojo "Resumen vencido" arriba del termómetro
- **AND** la columna 1 se etiqueta `VENCIDO` en color rojo
- **AND** el CTA primario es `[Pagar ahora]` en color rojo y el secundario `[Registrar consumo]`

#### Scenario: Detalle de tarjeta nueva muestra estado vacío sin termómetro

- **WHEN** el usuario abre el detalle de una tarjeta que nunca tuvo movimientos ni pagos en ningún período (todos los períodos tienen `tx_count=0` y ningún `period_payments`)
- **THEN** la pantalla NO renderiza el termómetro
- **AND** muestra el copy "Tu tarjeta está lista. Registrá el primer consumo para empezar a ver cómo viene cada resumen."
- **AND** el CTA primario es `[Registrar primer consumo]`

#### Scenario: Detalle sin credit_limit muestra hint para cargarlo

- **WHEN** el usuario abre el detalle de una tarjeta con `credit_limit=null` y al menos un movimiento
- **THEN** el termómetro renderiza las 3 columnas sin barras horizontales (solo monto ARS, USD subordinado si aplica, y "sin cuotas" cuando vacío)
- **AND** la línea total dice `"Cargá el límite para ver cuánto te queda"` con link `[Cargar]` al editor

#### Scenario: Columna PRÓXIMO sin compromisos muestra "sin cuotas"

- **WHEN** el período `PRÓXIMO` existe pero `pendingARS=0` y la tarjeta tiene `credit_limit` cargado
- **THEN** la columna se renderiza con barra al 0% (vacía), `$0` como monto y copy `"sin cuotas"` debajo

#### Scenario: USD subordinado se muestra siempre cuando la tarjeta tiene USD activo

- **WHEN** la tarjeta tiene `account_currencies` con `currency_code='USD'` y `is_active=true`
- **THEN** las 3 columnas del termómetro muestran línea `USD X,XX` subordinada, incluso cuando el monto es `0,00`

#### Scenario: USD no se muestra cuando la tarjeta no tiene USD activo

- **WHEN** la tarjeta solo tiene `currency_code='ARS'` activo
- **THEN** ninguna columna del termómetro muestra línea USD

#### Scenario: Tarjeta archivada con pendientes muestra termómetro y CTA Pagar

- **WHEN** la tarjeta está inactiva (`is_active=false`) y tiene al menos un período no-paid con `tx_count > 0`
- **THEN** se renderiza el termómetro normal con banner inactiva arriba
- **AND** el CTA `[Pagar resumen]` se muestra si el período activo está `closed` u `overdue`
- **AND** NO se renderiza `[Registrar consumo]`

#### Scenario: Tarjeta archivada sin pendientes muestra estado vacío

- **WHEN** la tarjeta está inactiva y todos sus períodos están `paid` o tienen `tx_count=0`
- **THEN** se renderiza un estado vacío "Tarjeta archivada · sin pendientes" sin termómetro
- **AND** se muestra la opción `[Reactivar]` (vía banner inactiva)
- **AND** el sistema NO ofrece `[Eliminar definitivamente]` (la regla de integridad de `accounts` impide borrar cuentas con historial)

#### Scenario: Sección Movimientos muestra un único link "Ver todos los resúmenes"

- **WHEN** el termómetro se renderiza (cualquier caso que no sea tarjeta nueva)
- **THEN** la sección "Movimientos del resumen actual" muestra exactamente un link en su encabezado, con label `"Ver todos los resúmenes →"`, apuntando a `/cards/[id]/periods`
- **AND** la sección NO incluye otro link con label `"Ver historial"` ni `"Ver resúmenes"` ni similares

#### Scenario: Movimientos del período actual se muestran todos sin paginación

- **WHEN** el período activo tiene 25 movimientos imputados
- **THEN** la sección Movimientos los muestra todos en una sola lista, sin botón "Ver más" ni paginación
- **AND** el orden es por `date DESC, created_at DESC, id DESC`

#### Scenario: Página no incluye botón "Cuotas — Próximamente"

- **WHEN** el usuario abre el detalle de cualquier tarjeta
- **THEN** la pantalla NO renderiza ningún botón etiquetado "Cuotas" en estado disabled o con badge "Próximamente"

---

### Requirement: El sistema muestra una pantalla con todos los resúmenes de una tarjeta

El sistema SHALL renderizar una pantalla `/cards/[id]/periods` que liste todos los `card_periods` de una tarjeta ordenados por `start_date` descendente. El `<h1>` de la pantalla SHALL ser **"Resúmenes"** (a secas), NO "Historial de resúmenes" — la lista incluye períodos pasados, presente y futuros, no solo historial.

Cada item SHALL mostrar el rango de fechas, el monto total de transacciones imputadas, la cantidad de movimientos, y un badge con la variante derivada (futuro / actual / cerrado-esperando-pago / vencido / pagado). El tap en un item SHALL navegar al detalle del período.

#### Scenario: La pantalla se titula "Resúmenes" sin la palabra "historial"

- **WHEN** el usuario navega a `/cards/[id]/periods`
- **THEN** el `<h1>` de la pantalla muestra exactamente "Resúmenes"

#### Scenario: Pantalla de resúmenes muestra cinco períodos en distintos estados

- **WHEN** el usuario abre la pantalla de resúmenes de una tarjeta con un período `paid`, dos `closed`, uno `open` y uno `futuro`
- **THEN** la lista los muestra todos con su badge correspondiente, ordenados por `start_date` desc

#### Scenario: Item de resumen muestra info contextual del pago cuando está pagado

- **WHEN** un item es de estado `paid`
- **THEN** la metadata muestra "Pagado DD-mm · N movimientos"

#### Scenario: El monto total del período usa aritmética decimal

- **WHEN** un período contiene consumos por `$0.10`, `$0.20` y un ajuste visual/total equivalente a `-$0.30`
- **THEN** el total monetario del período se calcula como `0`
- **AND** no quedan residuos binarios visibles ni comparables en la UI

---

### Requirement: El sistema muestra mora visible cuando un resumen vence sin pago

El sistema SHALL diferenciar visualmente los períodos `overdue` (vencidos sin pago) en todas las pantallas relevantes:

- **Listado de tarjetas**: card con footer rojo y texto "Vencido hace N días" en peso bold.
- **Detalle de tarjeta** (`/cards/[id]`): banner full-width rojo "Resumen vencido" arriba del termómetro; la columna `EN CURSO` se etiqueta `VENCIDO` en color rojo; el CTA primario es `[Pagar ahora]` en color rojo. El sistema SHALL NOT mostrar un banner ámbar "El vencimiento se acerca" en esta pantalla: cuando el período está cerca de vencer (estado `closed`), la información ya se comunica con la etiqueta `POR PAGAR` y el campo `vence DD/MM` de la columna.
- **Pantalla de resúmenes** (`/cards/[id]/periods`): badge `Vencido` en color de error.

La cantidad de días vencido SHALL calcularse como `today − due_date`.

#### Scenario: Tarjeta vencida hace 3 días en el listado

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-18'`, sin pago
- **THEN** la card del listado muestra footer rojo con "Vencido hace 3 días"

#### Scenario: Detalle de tarjeta vencida muestra banner rojo full-width y CTA Pagar ahora

- **WHEN** el usuario abre el detalle de una tarjeta cuyo período activo está `overdue` hace 5 días
- **THEN** se renderiza un banner full-width rojo "Resumen vencido" arriba del termómetro
- **AND** la columna `EN CURSO` se etiqueta `VENCIDO` con color rojo
- **AND** el CTA primario es `[Pagar ahora]` en color rojo

#### Scenario: Detalle de tarjeta cercana al vencimiento NO muestra banner ámbar

- **WHEN** el período activo está `closed` (`end_date < today < due_date`), sin pago, faltan 2 días al `due_date`
- **THEN** la pantalla NO renderiza ningún banner full-width
- **AND** la información de vencimiento se comunica vía la etiqueta `POR PAGAR` (ámbar) y el texto `vence DD/MM` de la columna
