## MODIFIED Requirements

### Requirement: El detalle de tarjeta muestra el resumen actual, próximo, y acciones primarias

El sistema SHALL renderizar la pantalla de detalle de una tarjeta de crédito (`/cards/[id]`) con la siguiente estructura, de arriba hacia abajo:

1. **Breadcrumb** "← Tarjetas".
2. **Identidad**: nombre de la tarjeta, banco (si lo hay), y `Límite $X` formateado en ARS. El segmento "Límite $X" SHALL omitirse cuando `credit_limit` es `null`.
3. **Banner contextual de pago** arriba del termómetro cuando el período activo requiere pago. Combina el texto de alerta y el CTA de pago **integrado a la derecha** (no hay botón de pago ancho debajo del termómetro). Dos tonos:
   - `vencido` (`overdue`): banner **rojo**, texto "Resumen vencido — evitá cargos por mora", CTA `[Pagar ahora]`.
   - `cerrado_esperando_pago` (`closed`): banner **ámbar**, texto "Resumen cerrado — vence el DD/MM", CTA `[Pagar resumen]`.

   Para los demás estados (`actual`, `pagado`, futuro) no se renderiza banner. NO existe un banner separado de "se acerca el vencimiento": cuando el período está `closed`, el banner ámbar de POR PAGAR ya comunica el vencimiento próximo y ofrece el pago.
4. **Termómetro "Cómo viene tu tarjeta"** con tres columnas siempre presentes — `EN CURSO`, `PRÓXIMO`, `SIGUIENTE`. Cada columna SHALL mostrar:
   - `cierra DD/MM` y `vence DD/MM` arriba.
   - Barra horizontal con `% usado = pendingARS_de_esa_columna / credit_limit` (solo si hay límite cargado). Color: ≤69% primario, 70%-89% ámbar, ≥90% rojo.
   - Monto ARS pendiente formateado.
   - Monto USD subordinado (`USD X,XX` chiquito) **solo cuando el monto USD pendiente de esa columna es > 0**. Si la columna no tiene USD pendiente, no se renderiza la línea USD (evita repetir `USD 0,00` como ruido en tarjetas con USD activo pero sin consumos en dólares).
   - Texto `"sin movimientos"` debajo del monto cuando la columna no tiene ni ARS ni USD pendientes (`pendingARS = 0` y `pendingUSD = 0`).

   La columna 1 (período activo) SHALL etiquetarse según el estado derivado del período activo: `EN CURSO` (`actual`, neutral), `POR PAGAR` (`closed`, ámbar), `VENCIDO` (`overdue`, rojo), `PAGADO` (`paid`, gris/verde). Las columnas 2 y 3 SHALL etiquetarse `PRÓXIMO` y `SIGUIENTE` siempre (estado típico: `futuro` o vacío).

   El termómetro NO se renderiza en el caso `tarjeta_nueva` (ver requirement de estado vacío); en su lugar se renderiza el estado vacío específico.

5. **Línea total de disponible** debajo del termómetro, con cuatro variantes mutuamente excluyentes:
   - Normal: `Disponible $X de $Y` donde `X = credit_limit − Σ(pendingARS de las 3 columnas)` y `Y = credit_limit`.
   - Sin compromisos (`X == Y`): `Disponible $Y de $Y`.
   - Excede el límite (`X < 0`): `Comprometido $|monto_total_comprometido| — $|X| por encima del límite` en color de alerta.
   - Sin límite cargado (`credit_limit` es `null`): `"Cargá el límite para ver cuánto te queda"` con link `[Cargar]` que navega al editor de la tarjeta.

   El cálculo es ARS-only: los montos USD subordinados NO entran (principio Bimoneda + `I-CRED-9`).

6. **CTAs por estado del período activo**. El CTA de pago vive SIEMPRE dentro del banner contextual (punto 3), no como botón ancho debajo del termómetro. Debajo del termómetro y la línea de disponible se renderiza, como máximo, `[Registrar consumo]`:
   - `actual`, `pagado`: solo `[Registrar consumo]` (sin banner).
   - `cerrado_esperando_pago`: banner ámbar con `[Pagar resumen]` integrado (punto 3) + `[Registrar consumo]` debajo.
   - `vencido`: banner rojo con `[Pagar ahora]` integrado (punto 3) + `[Registrar consumo]` debajo.
   - `tarjeta_nueva`: estado vacío sin termómetro + `[Registrar primer consumo]` (ver scenario).
   - Tarjeta archivada (`inactiva`): estado vacío "Tarjeta archivada · sin pendientes" con `[Reactivar]` como única acción. Por la regla de archivado (no se archiva una tarjeta con deuda — ver requirement "El usuario puede archivar una tarjeta sin deuda"), una tarjeta inactiva NUNCA tiene consumos pendientes; por eso el detalle de una archivada es siempre este estado vacío, sin termómetro ni CTA de pago. El sistema NO ofrece `[Eliminar definitivamente]` porque la action `deleteAccount` bloquea el borrado de toda cuenta con historial transaccional (regla de integridad contable preexistente en `accounts`).

   El sistema SHALL NOT renderizar un botón "Cuotas — Próximamente". La feature de cuotas, cuando exista, agregará su CTA mediante un nuevo requirement.

7. **Sección "Movimientos del resumen actual"**: lista completa sin paginación de las transacciones imputadas al período activo, ordenadas por `date DESC, created_at DESC, id DESC` (orden de display). El encabezado de la sección SHALL incluir un único link `"Ver todos los resúmenes →"` apuntando a `/cards/[id]/periods`. NO se muestran links duplicados con labels distintos.

8. **Footer admin** discreto al pie con links: `Detalles` (fecha de alta, fecha de archivado), `Editar`, y `Archivar` (si activa con movimientos) / `Eliminar` (si activa sin movimientos) / `Reactivar` (si inactiva).

#### Scenario: Detalle con período `actual` y límite cargado muestra termómetro normal

- **WHEN** el usuario abre el detalle de una tarjeta activa con período actual `open` (sin pago), `credit_limit=$200.000`, `pendingARS_actual=$156.000`, `pendingARS_próximo=$40.000` (cuotas), `pendingARS_siguiente=$25.000` (cuotas)
- **THEN** el termómetro muestra columna `EN CURSO` (neutral, 78%, $156.000), columna `PRÓXIMO` (20%, $40.000), columna `SIGUIENTE` (13%, $25.000)
- **AND** la línea total dice `Disponible $-21.000 de $200.000` formateado como `Comprometido $221.000 — $21.000 por encima del límite` en color de alerta
- **AND** el CTA primario es `[Registrar consumo]`

#### Scenario: Detalle con período `cerrado_esperando_pago` muestra banner ámbar y etiqueta POR PAGAR

- **WHEN** el período activo tiene `end_date < today ≤ due_date` sin pago
- **THEN** se renderiza un banner ámbar "Resumen cerrado — vence el DD/MM" arriba del termómetro, con `[Pagar resumen]` integrado a la derecha
- **AND** la columna 1 del termómetro se etiqueta `POR PAGAR` con color ámbar
- **AND** debajo del termómetro el único CTA es `[Registrar consumo]`

#### Scenario: Detalle con período `vencido` muestra banner rojo, etiqueta VENCIDO y CTA Pagar ahora

- **WHEN** el período activo está `overdue` (`due_date < today` sin pago)
- **THEN** se renderiza un banner rojo "Resumen vencido — evitá cargos por mora" arriba del termómetro, con `[Pagar ahora]` integrado a la derecha
- **AND** la columna 1 se etiqueta `VENCIDO` en color rojo
- **AND** debajo del termómetro el único CTA es `[Registrar consumo]`

#### Scenario: Detalle de tarjeta nueva muestra estado vacío sin termómetro

- **WHEN** el usuario abre el detalle de una tarjeta que nunca tuvo movimientos ni pagos en ningún período (todos los períodos tienen `tx_count=0` y ningún `period_payments`)
- **THEN** la pantalla NO renderiza el termómetro
- **AND** muestra el copy "Tu tarjeta está lista. Registrá el primer consumo para empezar a ver cómo viene cada resumen."
- **AND** el CTA primario es `[Registrar primer consumo]`

#### Scenario: Detalle sin credit_limit muestra hint para cargarlo

- **WHEN** el usuario abre el detalle de una tarjeta con `credit_limit=null` y al menos un movimiento
- **THEN** el termómetro renderiza las 3 columnas sin barras horizontales (solo monto ARS, USD subordinado solo si esa columna tiene USD > 0, y "sin movimientos" cuando la columna está vacía)
- **AND** la línea total dice `"Cargá el límite para ver cuánto te queda"` con link `[Cargar]` al editor

#### Scenario: Columna PRÓXIMO sin compromisos muestra "sin movimientos"

- **WHEN** el período `PRÓXIMO` existe pero `pendingARS=0` y `pendingUSD=0` y la tarjeta tiene `credit_limit` cargado
- **THEN** la columna se renderiza con barra al 0% (vacía), `$0` como monto y copy `"sin movimientos"` debajo

#### Scenario: USD subordinado se muestra solo en columnas con USD pendiente > 0

- **WHEN** la tarjeta tiene USD activo, la columna `EN CURSO` tiene `pendingUSD = 50` y las columnas `PRÓXIMO` y `SIGUIENTE` tienen `pendingUSD = 0`
- **THEN** solo la columna `EN CURSO` muestra la línea `USD 50,00` subordinada
- **AND** `PRÓXIMO` y `SIGUIENTE` no muestran línea USD

#### Scenario: USD no se muestra cuando ninguna columna tiene USD pendiente

- **WHEN** la tarjeta tiene USD activo pero sin consumos en dólares (todas las columnas `pendingUSD = 0`), o la tarjeta solo tiene `ARS` activo
- **THEN** ninguna columna del termómetro muestra línea USD (no se renderiza `USD 0,00`)

#### Scenario: Tarjeta archivada muestra siempre el estado vacío "sin pendientes"

- **WHEN** la tarjeta está inactiva (`is_active=false`)
- **THEN** se renderiza un estado vacío "Tarjeta archivada · sin pendientes" sin termómetro
- **AND** se muestra la opción `[Reactivar]` (vía banner inactiva)
- **AND** el sistema NO ofrece `[Eliminar definitivamente]` (la regla de integridad de `accounts` impide borrar cuentas con historial)
- **AND** no existe un estado "archivada con pendientes": la regla de archivado garantiza que una tarjeta inactiva no tiene consumos pendientes (ver requirement "El usuario puede archivar una tarjeta sin deuda")

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
- **Detalle de tarjeta** (`/cards/[id]`): banner contextual **rojo** "Resumen vencido — evitá cargos por mora" arriba del termómetro, con `[Pagar ahora]` integrado; la columna `EN CURSO` se etiqueta `VENCIDO` en color rojo. El sistema SHALL NOT mostrar un banner separado de "El vencimiento se acerca": cuando el período está `closed` (cerrado pero no vencido), se muestra el banner contextual **ámbar** de POR PAGAR ("Resumen cerrado — vence el DD/MM", con `[Pagar resumen]`), que ya comunica el vencimiento próximo y ofrece el pago.
- **Pantalla de resúmenes** (`/cards/[id]/periods`): badge `Vencido` en color de error.

La cantidad de días vencido SHALL calcularse como `today − due_date`.

#### Scenario: Tarjeta vencida hace 3 días en el listado

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-18'`, sin pago
- **THEN** la card del listado muestra footer rojo con "Vencido hace 3 días"

#### Scenario: Detalle de tarjeta vencida muestra banner rojo con CTA Pagar ahora integrado

- **WHEN** el usuario abre el detalle de una tarjeta cuyo período activo está `overdue` hace 5 días
- **THEN** se renderiza un banner contextual rojo "Resumen vencido — evitá cargos por mora" arriba del termómetro, con `[Pagar ahora]` integrado a la derecha
- **AND** la columna `EN CURSO` se etiqueta `VENCIDO` con color rojo
- **AND** debajo del termómetro el único CTA es `[Registrar consumo]`

#### Scenario: Detalle de tarjeta `closed` muestra banner ámbar POR PAGAR (no el rojo de vencido)

- **WHEN** el período activo está `closed` (`end_date < today < due_date`), sin pago, faltan 2 días al `due_date`
- **THEN** se renderiza el banner contextual ámbar "Resumen cerrado — vence el DD/MM" con `[Pagar resumen]` integrado, NO el banner rojo de vencido
- **AND** la columna 1 se etiqueta `POR PAGAR` (ámbar)
- **AND** no existe un banner separado de "El vencimiento se acerca"

---

### Requirement: El listado de tarjetas se muestra como carrusel horizontal con resumen actual

El sistema SHALL renderizar el listado de tarjetas de crédito del usuario como un carrusel horizontal. Cada card SHALL mostrar: nombre, banco, red, monto del resumen del período actual, porcentaje de límite disponible (si hay `credit_limit`), fecha de cierre y de vencimiento, y alertas visuales según los días al vencimiento (rojo ≤3, ámbar ≤7, normal >7). El orden de las cards SHALL ser por fecha de cierre del período activo ascendente; las tarjetas sin ciclo configurado SHALL ir al final ordenadas alfabéticamente.

El carrusel SHALL incluir únicamente tarjetas activas (`is_active=true`). Las tarjetas archivadas (`is_active=false`) NO aparecen en el carrusel, pero el sistema SHALL exponerlas en una sección secundaria **"Archivadas"** debajo del carrusel, para que la acción `[Reactivar]` (que vive en el detalle de la tarjeta) sea alcanzable. Sin esta sección, una tarjeta archivada quedaría inaccesible desde la UI y no habría forma de reactivarla.

La sección "Archivadas":
- SHALL renderizarse solo cuando existe al menos una tarjeta archivada; si no hay ninguna, NO se renderiza nada.
- SHALL ser colapsable (cerrada por defecto) para no competir con el contenido principal, con un encabezado que indique la cantidad (`Archivadas (N)`).
- SHALL listar cada tarjeta archivada con su nombre y un enlace a su detalle (`/cards/[id]`), donde el usuario puede reactivarla.

#### Scenario: Listado con tres tarjetas activas

- **WHEN** el usuario abre el listado y tiene tres tarjetas activas con cierres `2026-05-20`, `2026-05-25`, `2026-06-05`
- **THEN** el carrusel muestra las tres en orden ascendente por fecha de cierre

#### Scenario: Tarjeta con vencimiento en 2 días muestra alerta roja

- **WHEN** una tarjeta tiene `due_date='2026-05-15'` y `today='2026-05-13'`, sin `period_payment`
- **THEN** la card del carrusel se renderiza con footer rojo y "Vence DD-mm" en peso bold

#### Scenario: Tarjeta sin ciclo configurado va al final

- **WHEN** el usuario tiene tres tarjetas, una de ellas sin períodos creados
- **THEN** el carrusel muestra primero las dos con ciclo (ordenadas por cierre) y al final la sin ciclo

#### Scenario: Tarjeta archivada aparece en la sección "Archivadas" y no en el carrusel

- **WHEN** el usuario tiene una tarjeta activa y una archivada
- **THEN** el carrusel muestra solo la activa
- **AND** debajo se renderiza la sección colapsable "Archivadas (1)" con un enlace al detalle de la tarjeta archivada

#### Scenario: Usuario sin tarjetas archivadas no ve la sección

- **WHEN** el usuario tiene solo tarjetas activas (o ninguna)
- **THEN** la sección "Archivadas" NO se renderiza

#### Scenario: Usuario llega al detalle de la archivada y la reactiva

- **WHEN** el usuario abre la sección "Archivadas" y toca el enlace de una tarjeta
- **THEN** navega al detalle de esa tarjeta (`/cards/[id]`)
- **AND** desde ahí puede tocar `[Reactivar]`, lo que la devuelve al carrusel activo
