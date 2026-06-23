## MODIFIED Requirements

### Requirement: La card "Dónde está" desglosa las cuentas del usuario

Junto al Hero "Para gastar · hoy", el dashboard SHALL renderizar una card "Dónde está" que desglosa dónde vive el disponible (a la derecha del Hero en desktop web; apilada debajo en mobile-web y en la app nativa). Los datos SHALL salir de la misma data de `getDashboardHero` que alimenta el Hero — en web vía un único container async para la fila superior; en nativo ambas cards consumen `useDashboardHero()` y TanStack dedupea por queryKey (un solo fetch). La card SHALL considerar las cuentas activas `type IN ('cash','bank')` ordenadas por saldo ARS descendente (el orden que ya devuelve `getDashboardHero`), truncadas a un máximo de 6; el resto se ve en el módulo Cuentas. El header de la card SHALL incluir un link "Ver todas" → módulo Cuentas (web: `/accounts`; nativo: `router.push('/accounts')`). Todos los importes de la card participan del eye-mask.

Al rotular cada cuenta (tanto en el callout de concentración como en la grilla compacta), la card SHALL mostrar el **nombre de la institución/banco** de la cuenta cuando exista (`HeroAccountBalance.institutionName`), cayendo al **nombre dado por el usuario** (`name`) cuando la cuenta no tiene institución (p. ej. efectivo). Esta regla SHALL aplicar idéntica en web y en nativo; el dato sale de `getDashboardHero`, no se deriva en la card.

**Presentación (web y mobile):** la card SHALL comunicar la **concentración** del saldo de un vistazo, sin lista larga, idéntica en ambas plataformas:

- Un **callout de concentración**: el porcentaje de la cuenta de mayor saldo ARS sobre el total ARS (`pct = cuenta_dominante.ars / Σ cuentas.ars`, redondeado a entero) en tipografía grande, junto al nombre (institución con fallback al nombre del usuario) y saldo de esa cuenta. El porcentaje SHALL derivarse de los datos, NO hardcodearse. Con `Σ = 0` (sin saldo ARS), el callout NO SHALL mostrarse.
- Una **barra de concentración** horizontal compuesta por un segmento por cuenta, cuyo ancho SHALL ser proporcional al saldo ARS de la cuenta sobre el total (`cuenta.ars / Σ`), nunca hardcodeado. Cada segmento usa el color de identidad de su cuenta (sin hex inline en web; mirror de tokens en nativo). Los segmentos sub-pixel PUEDEN recibir un ancho mínimo visible sin alterar el cálculo del dato.
- Una **grilla compacta** (2 columnas) con las cuentas restantes (cada celda: cuadradito de color + nombre de institución/banco con fallback al nombre del usuario + saldo ARS) y, como celda final destacada en emerald, la tenencia "En dólares" con el total USD del usuario (el mismo `usd` del Hero), que representa el stock total en USD y NO un desglose por cuenta. Un saldo ARS de cero SHALL pintarse atenuado.

El cálculo de concentración (porcentaje dominante + anchos de los segmentos) SHALL reusar la función pura `computeConcentration` de `@grana/dashboard` en ambas plataformas; no se duplica.

#### Scenario: Concentración calculada de los datos (web)

- **WHEN** el usuario tiene Cta remunerada $9.575.790,25, CA $146.939,17, Billetera $108.200, Personal Pay $53.082,99 y un total USD de u$s 600 (web)
- **THEN** el callout muestra `97%` con "Cta remunerada · $9.575.790,25"
- **AND** la barra de concentración muestra un segmento por cuenta con ancho proporcional a su saldo ARS sobre el total
- **AND** la grilla compacta lista las cuentas restantes y la fila "En dólares" muestra u$s 600 en emerald

#### Scenario: Concentración calculada de los datos (mobile)

- **WHEN** el usuario abre el dashboard nativo con Cta remunerada $9.575.790,25 dominante y otras cuentas menores
- **THEN** el callout muestra el `%` de la cuenta dominante con su nombre y saldo
- **AND** la barra de concentración muestra un segmento por cuenta con ancho proporcional a su saldo ARS sobre el total
- **AND** la grilla compacta lista las cuentas restantes y la fila "En dólares" en emerald

#### Scenario: El nombre del banco se muestra cuando la cuenta tiene institución (web y mobile)

- **WHEN** la cuenta dominante tiene `institutionName` "Banco Galicia" y `name` "Caja de ahorro sueldo"
- **THEN** el callout y la grilla rotulan esa cuenta como "Banco Galicia"
- **WHEN** una cuenta de efectivo tiene `institutionName` nulo y `name` "Billetera"
- **THEN** esa celda se rotula con "Billetera" (fallback al nombre del usuario)

#### Scenario: Una sola cuenta concentra el 100%

- **WHEN** el usuario tiene una única cuenta con saldo ARS y total USD cero
- **THEN** el callout muestra `100%` con esa cuenta
- **AND** la barra de concentración muestra un único segmento a ancho completo

#### Scenario: Sin saldo ARS no se muestra el callout

- **WHEN** todas las cuentas del usuario tienen saldo ARS cero
- **THEN** el callout de concentración NO se renderiza
- **AND** la card sigue mostrando las cuentas (atenuadas) y la fila "En dólares"

#### Scenario: Más de 6 cuentas se truncan

- **WHEN** el usuario tiene 9 cuentas cash/bank activas
- **THEN** la card considera las 6 de mayor saldo ARS + la fila "En dólares"
- **AND** el link "Ver todas" navega al módulo Cuentas donde está el listado completo

#### Scenario: Una sola llamada alimenta la fila superior (web)

- **WHEN** se inspecciona el container de la fila superior del dashboard web
- **THEN** un único container async llama a `getDashboardHero` y renderiza ambas cards (Hero + "Dónde está") con esa data
- **AND** NO hay una segunda llamada a `getDashboardHero` para la card de cuentas

#### Scenario: Un solo fetch alimenta ambas cards (mobile)

- **WHEN** la pantalla dashboard nativa monta Hero y "Dónde está"
- **THEN** ambos componentes consumen `useDashboardHero()` con la misma queryKey
- **AND** TanStack ejecuta un único fetch para los dos
