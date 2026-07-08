## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`). El navegador **gobierna solo la actividad del mes** (gasto y desglose): la **deuda y la proyección NO dependen del navegador** — son "hoy" (deuda neta a hoy; proyección siempre desde hoy hacia adelante). Para el mes seleccionado, la pantalla SHALL mostrar:

- **Hero "Gasto del hogar · neto":** el **neto protagonista** (`gastaron − reintegros`) en grande, con el bruto y los reintegros como dato secundario al costado. El gasto se cuenta en base **DEVENGADO** (por fecha de compra; cada cuota en su mes), total del hogar (ambas partes). Bimoneda siempre visible (USD subordinado). Debajo, **"En qué gastaron"**: el desglose por categoría en ARS y USD con **drill inline conservado** (tocar una categoría despliega sus movimientos sin navegar fuera).
- **Deuda fuera del hero:** la deuda neta por moneda vive en una **franja/tile propia fija en "hoy"** (no en el hero navegable), en lenguaje claro ("le debés a X" / "X te debe" / "están al día"), con accesos a **Saldar** (cuando hay deuda viva) y a **Ver el detalle** (la pantalla de cuenta corriente). El acceso se rotula por la acción, no por el objeto interno. Presentada con `text-expense`/`text-income`, nunca en rojo.
- **Lo que se viene:** tile de proyección (derivada con `asOf` corrido a cada mes), independiente del navegador.
- **Últimos movimientos:** la lista de movimientos compartidos del mes, presentada como **log de gastos** (no como estado de deuda; la deuda ya vive, sin ambigüedad, en la franja de deuda). Cada fila SHALL mostrar dos cifras **fijas e invariantes a quién pagó**: el **total del movimiento como protagonista** (`amount`, en grande), presentado como gasto (`−`, `text-expense`; el reintegro con `+`/`text-income` si recibido); y la **parte propia del usuario como detalle secundario** ("Tu parte: {monto}", en chico, debajo), mostrada solo cuando hubo reparto real (`ownShare ≠ amount`). La fila NO SHALL mostrar rótulos de perspectiva de deuda que cambien de significado según el pagador ("parte de {nombre}"): el detalle secundario es siempre la parte propia. Quién pagó se conserva en el subtítulo ("Pagaste" / "Pagó {nombre}").

La pantalla SHALL ofrecer el **alta de movimiento** (CTA primary en web; FAB en mobile) y el acceso a **Configuración del hogar** como ícono. Los integrantes NO se muestran en la home.

#### Scenario: El navegador mueve solo la actividad, no la deuda ni la proyección

- **WHEN** el usuario cambia el navegador de mes
- **THEN** cambian el gasto del mes y su desglose
- **AND** la deuda (de hoy) y la proyección (desde hoy) NO cambian

#### Scenario: El neto es protagonista

- **WHEN** el mes tiene gastos y reintegros compartidos
- **THEN** el hero muestra el neto en grande y el bruto/reintegros como dato secundario

#### Scenario: El total es protagonista y la parte propia el detalle, invariantes a quién pagó

- **WHEN** un gasto compartido de `$10.000` mitad y mitad se muestra en Últimos movimientos, sin importar si lo pagó el usuario o el otro miembro
- **THEN** el monto protagonista de la fila es el total `−$10.000`, en `text-expense`
- **AND** debajo se muestra "Tu parte: $5.000" como dato secundario
- **AND** NO se muestra el rótulo "parte de {nombre}"

#### Scenario: El reintegro muestra el total como protagonista y la parte propia debajo

- **WHEN** un reintegro recibido de un gasto compartido mitad y mitad, de `$4.000` total, se muestra en Últimos movimientos
- **THEN** el monto protagonista de la fila es el total `+$4.000`, en `text-income`
- **AND** debajo se muestra "Tu parte: $2.000"

#### Scenario: Un movimiento 100% propio no repite la cifra

- **WHEN** un movimiento cuyo reparto deja la parte propia igual al total (`ownShare = amount`) se muestra en Últimos movimientos
- **THEN** la fila muestra el total como protagonista y OCULTA la línea "Tu parte" (sería redundante)
